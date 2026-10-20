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
} from './auth';
import { avecUtilisateur, utilisateurCourant } from './requete';

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[direct-dialog] serveur local prêt sur http://localhost:${PORT}`);
  console.log(`[direct-dialog] données : ${dataDir}/db.json`);
  console.log(`[direct-dialog] endpoints : ${Object.keys(endpoints).length}`);
});
