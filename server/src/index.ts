// Serveur local de l'application AdCampaign Manager.
//
// Il remplace le runtime Zite :
//   POST /api/<endpoint>                     → exécute src/api/<endpoint>.ts
//   POST /api/v1/zite/public/…/upload-session → upload de fichiers (pièces jointes)
//   GET  /files/<token>/<nom>                 → fichiers envoyés
//   GET  /*                                   → application React compilée (SPA)

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zite } from 'zitejs/db';
import { bootstrap } from './bootstrap';
import { autoriser } from './access';
import { settings } from './settings';
import {
  SESSION_COOKIE,
  DUREE_SESSION_MS,
  creerSession,
  detruireSession,
  lireCookie,
  sessionUtilisateur,
  verifierMotDePasse,
  hasherMotDePasse,
} from './auth';
import { avecUtilisateur, utilisateurCourant } from './requete';
import { can } from './permissions';
import { createEmailSender } from './email';
import {
  DEFAULT_CANAUX,
  MESSAGE_TEST,
  envoyerSurCanaux,
  normaliserCanaux,
  type Canaux,
} from './notifications';
import { analyserPanneaux, demarrerPlanificateur, envoyerAlertesPanneaux } from './alertes';

const { store, dataDir } = await bootstrap();

// Les endpoints sont chargés après bootstrap (voir bootstrap.ts).
const { endpoints }: { endpoints: Record<string, any> } = await import('./endpoints.generated');

const PORT = Number(process.env.PORT || 8080);

// Dossier de l'application compilée : `public/` dans l'image Docker, ou le
// `dist/` de Vite quand on lance le serveur depuis le dépôt.
function resolvePublicDir(): string {
  const candidates = [
    process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : undefined,
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'apps/adcampaign-manager/dist'),
    path.resolve(process.cwd(), '../apps/adcampaign-manager/dist'),
  ].filter(Boolean) as string[];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? candidates[1];
}

const PUBLIC_DIR = resolvePublicDir();
const UPLOAD_DIR = path.join(dataDir, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));

// ---------------------------------------------------------------------------
// Contexte de requête : résout la session une fois, pour toute la chaîne.
// ---------------------------------------------------------------------------
type RequeteAvecJeton = express.Request & { jetonSession?: string };

app.use((req, _res, next) => {
  const jeton = lireCookie(req.headers.cookie, SESSION_COOKIE);
  (req as RequeteAvecJeton).jetonSession = jeton;
  sessionUtilisateur(jeton)
    .then((utilisateur) => avecUtilisateur(utilisateur, () => next()))
    .catch(() => avecUtilisateur(null, () => next()));
});

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------
const tentatives = new Map<string, { nombre: number; jusqua: number }>();
const MAX_TENTATIVES = 8;
const BLOCAGE_MS = 5 * 60 * 1000;

function tentativeBloquee(cle: string): boolean {
  const entree = tentatives.get(cle);
  if (!entree) return false;
  if (entree.jusqua < Date.now()) {
    tentatives.delete(cle);
    return false;
  }
  return entree.nombre >= MAX_TENTATIVES;
}

function enregistrerEchec(cle: string) {
  const entree = tentatives.get(cle) ?? { nombre: 0, jusqua: 0 };
  entree.nombre += 1;
  entree.jusqua = Date.now() + BLOCAGE_MS;
  tentatives.set(cle, entree);
}

const utilisateurPublic = (u: any) => ({
  id: u.id,
  nomComplet: u.nomComplet,
  email: u.email,
  profil: u.profil,
  statut: u.statut,
  doitChangerMotDePasse: Boolean(u.doitChangerMotDePasse),
});

app.post('/api/auth/connexion', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const motDePasse = String(req.body?.motDePasse ?? '');
  if (!email || !motDePasse) {
    res.status(400).json({ message: 'E-mail et mot de passe requis.' });
    return;
  }

  const cle = `${email}|${req.ip}`;
  if (tentativeBloquee(cle)) {
    res.status(429).json({ message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    return;
  }

  const { records } = await zite.utilisateurs.findAll({ limit: 500 });
  const utilisateur = records.find((u) => (u.email ?? '').toLowerCase() === email);

  if (!utilisateur || !verifierMotDePasse(motDePasse, utilisateur.motDePasseHash)) {
    enregistrerEchec(cle);
    res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
    return;
  }
  if (utilisateur.statut === 'Inactif') {
    res.status(403).json({ message: 'Ce compte est désactivé.' });
    return;
  }

  tentatives.delete(cle);
  const { token } = await creerSession(utilisateur.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: DUREE_SESSION_MS,
    path: '/',
  });

  await zite.utilisateurs.update({
    id: utilisateur.id,
    record: { derniereConnexion: new Date().toISOString().slice(0, 10) },
  });

  res.json({ success: true, utilisateur: utilisateurPublic(utilisateur) });
});

app.post('/api/auth/deconnexion', async (req, res) => {
  await detruireSession((req as RequeteAvecJeton).jetonSession);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
});

app.get('/api/auth/moi', (req, res) => {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Non authentifié.' });
    return;
  }
  res.json({ utilisateur: utilisateurPublic(utilisateur) });
});

// ---------------------------------------------------------------------------
// Upload de fichiers (protocole attendu par zitejs/upload)
// ---------------------------------------------------------------------------
type PendingUpload = { filename: string; contentType: string; size: number; fileUrl: string };
const uploads = new Map<string, PendingUpload>();

const safeName = (name: unknown) =>
  path
    .basename(String(name || 'fichier'))
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120) || 'fichier';

app.post('/api/v1/zite/public/:flowId/upload-session', (req, res) => {
  const { filename, uploadLength, contentType } = req.body ?? {};
  const token = crypto.randomUUID();
  const name = safeName(filename);
  const fileUrl = `/files/${token}/${encodeURIComponent(name)}`;

  uploads.set(token, {
    filename: name,
    contentType: contentType || 'application/octet-stream',
    size: Number(uploadLength) || 0,
    fileUrl,
  });

  res.json({
    success: true,
    presignedUrl: `/api/v1/zite/public/upload/${token}`,
    fileUrl,
    contentType: contentType || 'application/octet-stream',
    completionToken: token,
  });
});

app.put(
  '/api/v1/zite/public/upload/:token',
  express.raw({ type: () => true, limit: '50mb' }),
  (req, res) => {
    const pending = uploads.get(req.params.token);
    if (!pending) {
      res.status(404).json({ success: false, message: 'Session d’envoi inconnue ou expirée.' });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
    fs.writeFileSync(path.join(UPLOAD_DIR, `${req.params.token}-${pending.filename}`), body);
    res.json({ success: true });
  },
);

app.post('/api/v1/zite/public/:flowId/complete-upload', (_req, res) => {
  res.json({ success: true });
});

app.get('/files/:token/:filename', (req, res) => {
  const file = path.join(UPLOAD_DIR, `${safeName(req.params.token)}-${safeName(req.params.filename)}`);
  if (!fs.existsSync(file)) {
    res.status(404).end();
    return;
  }
  res.sendFile(file);
});

// ---------------------------------------------------------------------------
// Sauvegarde des données
// ---------------------------------------------------------------------------
app.get('/api/export', async (_req, res) => {
  if (!utilisateurCourant()) {
    res.status(401).json({ message: 'Non authentifié.' });
    return;
  }
  const verdict = await autoriser('exportDonnees');
  if (!verdict.autorise) {
    res.status(403).json({ message: verdict.message });
    return;
  }
  const nom = `direct-dialog-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nom}"`);
  res.send(JSON.stringify(store.snapshot(), null, 1));
});

// ---------------------------------------------------------------------------
// Exécution des endpoints de l'application
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Notifications : configuration, test, envoi manuel des alertes panneaux.
// ---------------------------------------------------------------------------
const archiveEmail = createEmailSender(dataDir);

async function exigerGestionParametres(res: express.Response): Promise<boolean> {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Non authentifié' });
    return false;
  }
  if (utilisateur.profil === 'Administrateur') return true;
  const permissions = await settings.permissions();
  if (!can(permissions, utilisateur.profil, 'parametres', 'gerer')) {
    res.status(403).json({ message: 'Accès refusé' });
    return false;
  }
  return true;
}

app.get('/api/notifications', async (_req, res) => {
  const config = normaliserCanaux(await settings.get<Canaux>('notifications', DEFAULT_CANAUX));
  const { records } = await store.findAll('Emplacements', { limit: 1000 });
  const alertes = analyserPanneaux(records, config.alerteJours);
  const historique = await settings.get<any[]>('notificationsHistorique', []);
  const dernierEnvoi = await settings.get<string>('notificationsDernierEnvoi', '');
  res.json({ config, alertes, historique, dernierEnvoi });
});

app.put('/api/notifications', async (req, res) => {
  if (!(await exigerGestionParametres(res))) return;
  const config = normaliserCanaux(req.body ?? {});
  await settings.set('notifications', config);
  res.json({ config });
});

app.post('/api/notifications/test', async (req, res) => {
  if (!(await exigerGestionParametres(res))) return;
  const config = normaliserCanaux(await settings.get<Canaux>('notifications', DEFAULT_CANAUX));
  const canal = String(req.body?.canal ?? '');
  const cible: Canaux = {
    ...config,
    email: { ...config.email, actif: canal === 'email' },
    telegram: { ...config.telegram, actif: canal === 'telegram' },
    whatsapp: { ...config.whatsapp, actif: canal === 'whatsapp' },
  };
  const resultats = await envoyerSurCanaux(cible, 'DIRECT DIALOG — test', MESSAGE_TEST, archiveEmail);
  res.json({ resultats });
});

app.post('/api/notifications/envoyer', async (_req, res) => {
  if (!(await exigerGestionParametres(res))) return;
  const resultat = await envoyerAlertesPanneaux({
    store,
    settings,
    archiveEmail,
    forcer: true,
  });
  res.json(resultat);
});

// ---------------------------------------------------------------------------
// Espace client public : inscription, panneaux disponibles, réservation.
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifierAdmins(settingsRef: typeof settings, archive: (p: Record<string, any>) => Promise<any>, sujet: string, texte: string) {
  const config = normaliserCanaux(await settingsRef.get<Canaux>('notifications', DEFAULT_CANAUX));

  // Les alertes client partent toujours : destinataires configurés, sinon
  // l'e-mail de la société, sinon les comptes administrateurs.
  let destinataires = config.email.destinataires;
  if (destinataires.length === 0) {
    const societe = await settingsRef.societe();
    if (societe.email) destinataires = [societe.email];
  }
  if (destinataires.length === 0) {
    const { records } = await zite.utilisateurs.findAll({ limit: 500 });
    destinataires = records
      .filter((u) => u.profil === 'Administrateur' && u.email)
      .map((u) => String(u.email));
  }

  const cible: Canaux = {
    ...config,
    telegram: { ...config.telegram, actif: false },
    whatsapp: { ...config.whatsapp, actif: false },
    email: { actif: destinataires.length > 0, destinataires },
  };
  return envoyerSurCanaux(cible, sujet, texte, archive);
}

async function notifierClient(
  settingsRef: typeof settings,
  archive: (p: Record<string, any>) => Promise<any>,
  email: string,
  sujet: string,
  texte: string,
) {
  const config = normaliserCanaux(await settingsRef.get<Canaux>('notifications', DEFAULT_CANAUX));
  const cible: Canaux = {
    ...config,
    telegram: { ...config.telegram, actif: false },
    whatsapp: { ...config.whatsapp, actif: false },
    email: { actif: true, destinataires: [email] },
  };
  return envoyerSurCanaux(cible, sujet, texte, archive);
}

app.post('/api/inscription', async (req, res) => {
  const nomComplet = String(req.body?.nomComplet ?? '').trim();
  const societe = String(req.body?.societe ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const telephone = String(req.body?.telephone ?? '').trim();
  const motDePasse = String(req.body?.motDePasse ?? '');

  if (!nomComplet || !EMAIL_REGEX.test(email) || motDePasse.length < 8) {
    res.status(400).json({ message: 'Nom, e-mail valide et mot de passe de 8 caractères minimum requis.' });
    return;
  }

  const { records } = await zite.utilisateurs.findAll({ limit: 1000 });
  if (records.some((u) => (u.email ?? '').toLowerCase() === email)) {
    res.status(409).json({ message: 'Un compte existe déjà avec cet e-mail.' });
    return;
  }

  // Fiche client (pour les réservations et les factures).
  const client = await zite.clients.create({
    record: {
      nomClient: societe || nomComplet,
      email,
      telephone: telephone || undefined,
      statut: 'Actif',
      secteurDactivite: undefined,
      adresse: undefined,
    },
  });

  const utilisateur = await zite.utilisateurs.create({
    record: {
      nomComplet,
      email,
      telephone: telephone || undefined,
      profil: 'Client',
      statut: 'Actif',
      notes: societe ? `Société : ${societe}` : undefined,
      motDePasseHash: hasherMotDePasse(motDePasse),
      doitChangerMotDePasse: false,
      clientId: client.id,
    },
  });

  // Connexion immédiate du client.
  const { token } = await creerSession(utilisateur.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: DUREE_SESSION_MS,
    path: '/',
  });

  // Notifications : équipe + confirmation client.
  const texteAdmin = [
    'Nouvelle inscription client',
    '',
    `Nom : ${nomComplet}`,
    societe ? `Société : ${societe}` : '',
    `E-mail : ${email}`,
    telephone ? `Téléphone : ${telephone}` : '',
    '',
    'Le client peut désormais consulter les panneaux disponibles et réserver.',
  ].filter(Boolean).join('\n');
  const texteClient = [
    `Bonjour ${nomComplet},`,
    '',
    'Votre compte DIRECT DIALOG est créé.',
    'Vous pouvez consulter les panneaux disponibles et réserver ceux qui vous intéressent.',
    '',
    '— DIRECT DIALOG',
  ].join('\n');

  Promise.all([
    notifierAdmins(settings, archiveEmail, '[DIRECT DIALOG] Nouvelle inscription client', texteAdmin),
    notifierClient(settings, archiveEmail, email, 'Bienvenue chez DIRECT DIALOG', texteClient),
  ]).catch((erreur) => console.error('[inscription] notification :', erreur));

  res.json({ success: true, utilisateur: utilisateurPublic(utilisateur), clientId: client.id });
});

app.get('/api/panneaux-disponibles', async (req, res) => {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Connectez-vous pour voir les panneaux.' });
    return;
  }

  const [{ records: emplacements }, { records: reservations }] = await Promise.all([
    zite.emplacements.findAll({ limit: 1000 }),
    zite.reservations.findAll({ limit: 1000 }),
  ]);

  const occupees = new Set(
    reservations
      .filter((r) => ['En attente', 'Confirmée', 'En cours'].includes(String(r.statut ?? '')))
      .map((r) => (Array.isArray(r.emplacement) ? r.emplacement[0] : r.emplacement))
      .filter(Boolean),
  );

  const disponibles = emplacements
    .filter((e) => e.disponibilite === 'Disponible' && !occupees.has(e.id))
    .map((e) => ({
      id: e.id,
      reference: e.referenceEmplacement,
      quartier: e.quartier ?? '',
      ville: e.ville ?? '',
      localisation: e.localisation ?? '',
      type: e.type ?? '',
      format: e.format ?? '',
      prixParSemaine: e.prixParSemaine ?? 0,
      latitude: e.latitude,
      longitude: e.longitude,
      disponibleDu: e.disponibleDu ?? '',
      disponibleAu: e.disponibleAu ?? '',
      photo: Array.isArray(e.photo) ? e.photo.map((p: any) => p?.url).filter(Boolean) : [],
    }));

  res.json({ panneaux: disponibles });
});

app.post('/api/reserver', async (req, res) => {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Connectez-vous pour réserver.' });
    return;
  }
  if (!['Client', 'Administrateur', 'Commercial', 'Responsable des opérations'].includes(String(utilisateur.profil ?? ''))) {
    res.status(403).json({ message: 'Votre profil ne peut pas réserver depuis cet espace.' });
    return;
  }

  const emplacementId = String(req.body?.emplacementId ?? '');
  const dateDebut = String(req.body?.dateDebut ?? '');
  const dateFin = String(req.body?.dateFin ?? '');
  const message = String(req.body?.message ?? '').trim();

  if (!emplacementId || !dateDebut || !dateFin) {
    res.status(400).json({ message: 'Panneau, date de début et date de fin requis.' });
    return;
  }
  if (dateFin < dateDebut) {
    res.status(400).json({ message: 'La date de fin doit être postérieure au début.' });
    return;
  }
  if (dateDebut < new Date().toISOString().slice(0, 10)) {
    res.status(400).json({ message: 'La date de début ne peut pas être dans le passé.' });
    return;
  }

  const { records } = await zite.emplacements.findAll({ limit: 1000 });
  const panneau = records.find((e) => e.id === emplacementId);
  if (!panneau) {
    res.status(404).json({ message: 'Panneau introuvable.' });
    return;
  }
  if (panneau.disponibilite !== 'Disponible') {
    res.status(409).json({ message: 'Ce panneau n’est plus disponible.' });
    return;
  }

  const { records: reservations } = await zite.reservations.findAll({ limit: 1000 });
  const chevauche = reservations.some((r) => {
    const lien = Array.isArray(r.emplacement) ? r.emplacement[0] : r.emplacement;
    if (lien !== panneau.id) return false;
    if (!['En attente', 'Confirmée', 'En cours'].includes(String(r.statut ?? ''))) return false;
    const debut = String(r.dateDebut ?? '');
    const fin = String(r.dateFin ?? '');
    return !(dateFin < debut || dateDebut > fin);
  });
  if (chevauche) {
    res.status(409).json({ message: 'Ce panneau est déjà réservé sur cette période.' });
    return;
  }

  const jours = Math.max(1, Math.round((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 86_400_000) + 1);
  const montant = Math.round(((panneau.prixParSemaine ?? 0) * jours) / 7);
  const reference = `RES-${Date.now().toString(36).toUpperCase()}`;

  const clientId = utilisateur.clientId
    ?? (await zite.clients.findAll({ limit: 1000 })).records.find((c) => (c.email ?? '').toLowerCase() === (utilisateur.email ?? '').toLowerCase())?.id;

  const reservation = await zite.reservations.create({
    record: {
      referenceReservation: reference,
      emplacement: [panneau.id],
      client: clientId ? [clientId] : [],
      dateDebut,
      dateFin,
      statut: 'En attente',
      montant,
      message: message || undefined,
    },
  });

  await zite.emplacements.update({ id: panneau.id, record: { disponibilite: 'Réservé' } });

  const texteAdmin = [
    'Nouvelle réservation client',
    '',
    `Référence : ${reference}`,
    `Panneau : ${panneau.referenceEmplacement} — ${[panneau.quartier, panneau.ville].filter(Boolean).join(', ')}`,
    `Période : ${dateDebut} → ${dateFin} (${jours} jour(s))`,
    `Montant estimé : ${montant.toLocaleString('fr-FR')} ${(await settings.societe()).devise}`,
    `Client : ${utilisateur.nomComplet} (${utilisateur.email})`,
    message ? `Message : ${message}` : '',
  ].filter(Boolean).join('\n');

  const texteClient = [
    `Bonjour ${utilisateur.nomComplet},`,
    '',
    `Votre demande de réservation est enregistrée : ${reference}.`,
    `Panneau : ${panneau.referenceEmplacement} — ${[panneau.quartier, panneau.ville].filter(Boolean).join(', ')}`,
    `Période : ${dateDebut} → ${dateFin}`,
    '',
    'Notre équipe vous confirme la disponibilité sous 24 h.',
    '— DIRECT DIALOG',
  ].join('\n');

  Promise.all([
    notifierAdmins(settings, archiveEmail, `[DIRECT DIALOG] Réservation ${reference}`, texteAdmin),
    notifierClient(settings, archiveEmail, String(utilisateur.email ?? ''), `Réservation ${reference} enregistrée`, texteClient),
  ]).catch((erreur) => console.error('[reserver] notification :', erreur));

  res.json({ success: true, reservationId: reservation.id, reference, montant, jours });
});

app.get('/api/mes-reservations', async (req, res) => {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Non authentifié' });
    return;
  }
  const [{ records: reservations }, { records: emplacements }] = await Promise.all([
    zite.reservations.findAll({ limit: 1000 }),
    zite.emplacements.findAll({ limit: 1000 }),
  ]);
  const panneaux = new Map(emplacements.map((e) => [e.id, e]));
  const miennes = reservations
    .filter((r) => {
      const clientId = Array.isArray(r.client) ? r.client[0] : r.client;
      return utilisateur.clientId ? clientId === utilisateur.clientId : false;
    })
    .map((r) => {
      const lien = Array.isArray(r.emplacement) ? r.emplacement[0] : r.emplacement;
      const p = panneaux.get(lien);
      return {
        id: r.id,
        reference: r.referenceReservation,
        panneau: p?.referenceEmplacement ?? '',
        quartier: p?.quartier ?? '',
        ville: p?.ville ?? '',
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        statut: r.statut,
        montant: r.montant,
      };
    });
  res.json({ reservations: miennes });
});

app.post('/api/:name', async (req, res) => {
  const name = req.params.name;
  const endpoint = endpoints[name];

  if (!endpoint || typeof endpoint.execute !== 'function') {
    res.status(404).json({ message: `Endpoint inconnu : ${name}` });
    return;
  }

  const utilisateur = utilisateurCourant();
  if (!utilisateur) {
    res.status(401).json({ message: 'Non authentifié.', code: 'UNAUTHORIZED' });
    return;
  }

  const verdict = await autoriser(name);
  if (!verdict.autorise) {
    res.status(403).json({ message: verdict.message, code: 'FORBIDDEN' });
    return;
  }

  try {
    let input = (req.body && req.body.inputs) ?? {};

    // Le runtime Zite validait l'entrée via le schéma zod de l'endpoint.
    // On reproduit ce comportement (valeurs par défaut incluses).
    if (endpoint.inputSchema && typeof endpoint.inputSchema.parse === 'function') {
      try {
        input = endpoint.inputSchema.parse(input);
      } catch (erreur: any) {
        const details = Array.isArray(erreur?.issues)
          ? erreur.issues
              .map((i: any) => `${(i.path ?? []).join('.') || 'input'}: ${i.message}`)
              .join('; ')
          : 'Données invalides';
        res.status(400).json({
          message: `Données invalides — ${details}`,
          code: 'BAD_REQUEST',
          userFacingMessage: 'Certaines informations sont manquantes ou invalides.',
        });
        return;
      }
    }

    const result = await endpoint.execute({
      input,
      context: {
        user: {
          id: utilisateur.id,
          email: utilisateur.email ?? process.env.LOCAL_USER_EMAIL ?? '',
          roles: [],
        },
      },
    });
    res.json(result);
  } catch (error: any) {
    const status = error?.code === 'BAD_REQUEST' ? 400 : 500;
    console.error(`[api] ${name} → ${error?.message ?? error}`);
    res.status(status).json({
      message: error?.message ?? 'Erreur interne',
      code: error?.code,
      userFacingMessage: error?.userFacingMessage,
    });
  }
});

// ---------------------------------------------------------------------------
// Santé
// ---------------------------------------------------------------------------
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), tables: store.stats() });
});

// ---------------------------------------------------------------------------
// Application React compilée
// ---------------------------------------------------------------------------
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/files/')) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send(
        `Application non compilée.\n\nLancez « yarn build » puis redémarrez, ou utilisez « yarn dev » (Vite + proxy).\nDossier attendu : ${PUBLIC_DIR}`,
      );
  });
}

demarrerPlanificateur({ store, settings, archiveEmail });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[direct-dialog] serveur local prêt sur http://localhost:${PORT}`);
  console.log(`[direct-dialog] données : ${dataDir}/db.json`);
  console.log(`[direct-dialog] endpoints : ${Object.keys(endpoints).length}`);
});
