// Assistant DIRECT DIALOG : comprend une demande en français, interroge la base
// et répond avec un texte, des indicateurs, un tableau et un export CSV.
// Aucune clé d'API n'est nécessaire : le moteur est déterministe.

import type { Store } from './store';
import type { Settings } from './settings';
import type { Utilisateur } from './auth';
import { can, type ModuleKey, type Permissions } from './permissions';

export type Kpi = { libelle: string; valeur: string; ton?: 'ok' | 'attention' | 'danger' };

export type ResultatAgent = {
  intention: string;
  texte: string;
  kpis?: Kpi[];
  tableau?: { colonnes: string[]; lignes: (string | number)[][] };
  export?: { nom: string; csv: string };
  suggestions?: string[];
  liens?: { libelle: string; chemin: string }[];
};

type Contexte = {
  store: Store;
  settings: Settings;
  utilisateur: Utilisateur;
  permissions: Permissions;
};

type Ligne = Record<string, any>;

const sansAccent = (valeur: string) =>
  valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const nombre = (valeur: any) =>
  typeof valeur === 'number' ? valeur : Number(String(valeur ?? '').replace(/[^\d.-]/g, '')) || 0;

const argent = (valeur: any, devise = 'GNF') =>
  `${nombre(valeur).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${devise}`;

const dateFr = (valeur?: string) => {
  if (!valeur) return '—';
  const [annee, mois, jour] = String(valeur).slice(0, 10).split('-');
  return jour ? `${jour}/${mois}/${annee}` : String(valeur);
};

const aujourdHui = () => new Date().toISOString().slice(0, 10);

function csv(colonnes: string[], lignes: (string | number)[][]) {
  const echapper = (valeur: any) => `"${String(valeur ?? '').replace(/"/g, '""')}"`;
  return '\ufeff' + [colonnes, ...lignes].map((l) => l.map(echapper).join(';')).join('\r\n');
}

async function lire(ctx: Contexte, table: string): Promise<Ligne[]> {
  const { records } = await ctx.store.findAll(table, { limit: 2000 });
  return records as Ligne[];
}

function autorise(ctx: Contexte, module: ModuleKey): boolean {
  return can(ctx.permissions, ctx.utilisateur.profil, module, 'voir');
}

const refus = (module: string): ResultatAgent => ({
  intention: 'refus',
  texte: `Votre profil n'a pas accès au module « ${module} ». Demandez à un administrateur de vous ouvrir ce droit dans Paramètres → Rôles & accès.`,
  suggestions: ['Que puis-je faire ?', 'Aide'],
});

// --- Aide / formation ------------------------------------------------------
const AIDE: { cles: string[]; titre: string; etapes: string[]; lien?: string }[] = [
  {
    cles: ['campagne', 'creer une campagne', 'nouvelle campagne'],
    titre: 'Créer une campagne',
    etapes: [
      'Ouvrez Campagnes puis cliquez sur « Nouvelle campagne ».',
      'Renseignez le nom, le client, les dates de début et de fin, le budget.',
      'Choisissez le commercial responsable, puis enregistrez.',
      'La campagne passe en « Brouillon » : validez-la pour la lancer.',
    ],
    lien: '/campagnes',
  },
  {
    cles: ['panneau', 'emplacement', 'ajouter un panneau'],
    titre: 'Gérer les panneaux',
    etapes: [
      'Ouvrez Panneaux. La vue Carte montre l’emplacement de chaque panneau.',
      'Cliquez « Nouveau panneau » : référence, quartier, ville, format, prix.',
      'Dans la fiche, placez le panneau sur la carte ou saisissez ses coordonnées GPS.',
      'Renseignez « Disponible du / au » et la période de location.',
    ],
    lien: '/emplacements',
  },
  {
    cles: ['reservation', 'reserver'],
    titre: 'Réserver un panneau',
    etapes: [
      'Ouvrez Panneaux puis l’onglet Carte (ou Liste).',
      'Cliquez un panneau disponible, puis « Modifier » ou « Réserver ».',
      'Choisissez les dates de début et de fin, ajoutez un message.',
      'La réservation arrive en « En attente » : confirmez-la dans Réservations.',
    ],
    lien: '/reservations',
  },
  {
    cles: ['facture', 'facturation', 'creer une facture'],
    titre: 'Établir une facture',
    etapes: [
      'Ouvrez Facturation puis « Nouvelle facture ».',
      'Sélectionnez le client et la campagne, vérifiez les montants HT / TVA / TTC.',
      'Renseignez la date d’échéance, puis enregistrez.',
      'Le statut de paiement se met à jour dans la liste et le tableau de bord.',
    ],
    lien: '/factures',
  },
  {
    cles: ['stock', 'entree', 'sortie', 'inventaire'],
    titre: 'Gérer le stock',
    etapes: [
      'Ouvrez Gestion des Stocks.',
      '« Nouvel article » pour créer une référence (seuil d’alerte, prix, unité).',
      'Onglet « Entrées de stock » pour un réapprovisionnement.',
      'Onglet « Sorties de stock » pour une consommation : le stock est décrémenté.',
    ],
    lien: '/stock',
  },
  {
    cles: ['utilisateur', 'compte', 'profil', 'role', 'mot de passe'],
    titre: 'Créer un utilisateur',
    etapes: [
      'Paramètres → Utilisateurs → « Nouvel utilisateur ».',
      'Renseignez le nom, l’e-mail, le profil et un mot de passe.',
      'Le profil détermine les modules accessibles (Rôles & accès).',
      'Le client peut aussi s’inscrire lui-même via le lien d’inscription.',
    ],
    lien: '/parametres',
  },
  {
    cles: ['notification', 'email', 'telegram', 'whatsapp'],
    titre: 'Configurer les notifications',
    etapes: [
      'Paramètres → Notifications.',
      'Activez l’e-mail et saisissez les destinataires (et le serveur SMTP).',
      'Ajoutez Telegram (jeton + chat ID) ou WhatsApp (Meta Cloud API).',
      'Réglez l’heure d’envoi et le nombre de jours avant échéance, puis enregistrez.',
    ],
    lien: '/parametres',
  },
  {
    cles: ['client', 'inscription', 'espace client'],
    titre: 'Espace client',
    etapes: [
      'Le client s’inscrit via le lien /inscription (Paramètres → Utilisateurs → lien).',
      'Il ne voit que les panneaux disponibles et peut réserver.',
      'Ses réservations arrivent en « En attente » dans votre module Réservations.',
      'Vous recevez un e-mail à chaque inscription et réservation.',
    ],
    lien: '/reservations',
  },
];

function reponseAide(texte: string): ResultatAgent | null {
  const demande = sansAccent(texte);
  const sujet = AIDE.find((entree) => entree.cles.some((cle) => demande.includes(cle)));
  if (!sujet) return null;
  return {
    intention: 'aide',
    texte: `**${sujet.titre}** — voici les étapes :`,
    tableau: {
      colonnes: ['Étape', 'À faire'],
      lignes: sujet.etapes.map((etape, index) => [index + 1, etape]),
    },
    liens: sujet.lien ? [{ libelle: 'Ouvrir le module', chemin: sujet.lien }] : undefined,
    suggestions: ['Fais-moi un résumé', 'Rapport du stock'],
  };
}

// --- Rapports --------------------------------------------------------------
async function rapportStock(ctx: Contexte, demande: string): Promise<ResultatAgent> {
  if (!autorise(ctx, 'stock')) return refus('Gestion des Stocks');
  const articles = await lire(ctx, 'Stock');
  const devise = (await ctx.settings.societe()).devise;
  const enAlerte = articles.filter(
    (a) => nombre(a.quantiteEnStock) <= nombre(a.seuilDAlerte) && nombre(a.seuilDAlerte) > 0,
  );
  const ruptures = articles.filter((a) => nombre(a.quantiteEnStock) === 0);
  const valeur = articles.reduce((t, a) => t + nombre(a.quantiteEnStock) * nombre(a.prixUnitaire), 0);
  const filtre = demande.includes('rupture') ? ruptures : enAlerte;
  const lignes = (filtre.length ? filtre : articles).map((a) => [
    a.referenceArticle ?? '',
    a.nomArticle ?? '',
    a.categorie ?? '',
    `${nombre(a.quantiteEnStock)} ${a.unite ?? ''}`.trim(),
    nombre(a.seuilDAlerte),
    a.statutStock ?? '',
  ]);

  return {
    intention: 'rapport_stock',
    texte: `Rapport de stock : ${articles.length} article(s), dont **${enAlerte.length} en alerte** et **${ruptures.length} en rupture**. Valeur totale : **${argent(valeur, devise)}**.`,
    kpis: [
      { libelle: 'Articles', valeur: String(articles.length) },
      { libelle: 'Stock faible', valeur: String(enAlerte.length), ton: enAlerte.length ? 'attention' : 'ok' },
      { libelle: 'Ruptures', valeur: String(ruptures.length), ton: ruptures.length ? 'danger' : 'ok' },
      { libelle: 'Valeur', valeur: argent(valeur, devise) },
    ],
    tableau: {
      colonnes: ['Référence', 'Article', 'Catégorie', 'Quantité', 'Seuil', 'Statut'],
      lignes,
    },
    export: {
      nom: 'rapport-stock.csv',
      csv: csv(['Référence', 'Article', 'Catégorie', 'Quantité', 'Seuil', 'Statut'], lignes),
    },
    liens: [{ libelle: 'Ouvrir le stock', chemin: '/stock' }],
    suggestions: ['Stock en rupture', 'Factures impayées'],
  };
}

async function rapportFactures(ctx: Contexte, demande: string): Promise<ResultatAgent> {
  if (!autorise(ctx, 'factures')) return refus('Facturation');
  const factures = await lire(ctx, 'Factures');
  const devise = (await ctx.settings.societe()).devise;
  const aujourd = aujourdHui();
  const impayees = factures.filter((f) => f.statutPaiement !== 'Payée');
  const enRetard = impayees.filter((f) => f.dateEcheance && String(f.dateEcheance) < aujourd);
  const total = impayees.reduce((t, f) => t + nombre(f.montantTtc), 0);
  const retardTotal = enRetard.reduce((t, f) => t + nombre(f.montantTtc), 0);
  const base = demande.includes('retard') ? enRetard : impayees;

  const lignes = base.map((f) => [
    f.numeroFacture ?? '',
    f.clientNom ?? f.client ?? '',
    dateFr(f.dateEmission),
    dateFr(f.dateEcheance),
    argent(f.montantTtc, devise),
    f.statutPaiement ?? '',
  ]);

  return {
    intention: 'rapport_factures',
    texte: `${impayees.length} facture(s) non payée(s) pour **${argent(total, devise)}**, dont **${enRetard.length} en retard** (${argent(retardTotal, devise)}).`,
    kpis: [
      { libelle: 'Impayées', valeur: String(impayees.length), ton: impayees.length ? 'attention' : 'ok' },
      { libelle: 'En retard', valeur: String(enRetard.length), ton: enRetard.length ? 'danger' : 'ok' },
      { libelle: 'Montant dû', valeur: argent(total, devise) },
      { libelle: 'Retard', valeur: argent(retardTotal, devise), ton: enRetard.length ? 'danger' : 'ok' },
    ],
    tableau: {
      colonnes: ['Facture', 'Client', 'Émise', 'Échéance', 'TTC', 'Statut'],
      lignes,
    },
    export: {
      nom: 'factures-impayees.csv',
      csv: csv(['Facture', 'Client', 'Émise', 'Échéance', 'TTC', 'Statut'], lignes),
    },
    liens: [{ libelle: 'Ouvrir la facturation', chemin: '/factures' }],
    suggestions: ['Rapport des campagnes', 'Résumé du jour'],
  };
}

async function rapportCampagnes(ctx: Contexte): Promise<ResultatAgent> {
  if (!autorise(ctx, 'campagnes')) return refus('Campagnes');
  const campagnes = await lire(ctx, 'Campagnes');
  const devise = (await ctx.settings.societe()).devise;
  const parStatut = new Map<string, number>();
  for (const c of campagnes) {
    const statut = String(c.statut ?? 'Non défini');
    parStatut.set(statut, (parStatut.get(statut) ?? 0) + 1);
  }
  const budget = campagnes.reduce((t, c) => t + nombre(c.budgetTotal), 0);
  const lignes = campagnes.map((c) => [
    c.nomCampagne ?? '',
    c.statut ?? '',
    dateFr(c.dateDebut),
    dateFr(c.dateFin),
    argent(c.budgetTotal, devise),
    c.commercialResponsable ?? '',
  ]);

  return {
    intention: 'rapport_campagnes',
    texte: `${campagnes.length} campagne(s) pour un budget cumulé de **${argent(budget, devise)}**. Répartition : ${[...parStatut.entries()].map(([s, n]) => `${s} (${n})`).join(', ')}.`,
    kpis: [...parStatut.entries()].slice(0, 4).map(([statut, n]) => ({
      libelle: statut,
      valeur: String(n),
    })),
    tableau: {
      colonnes: ['Campagne', 'Statut', 'Début', 'Fin', 'Budget', 'Commercial'],
      lignes,
    },
    export: {
      nom: 'campagnes.csv',
      csv: csv(['Campagne', 'Statut', 'Début', 'Fin', 'Budget', 'Commercial'], lignes),
    },
    liens: [{ libelle: 'Ouvrir les campagnes', chemin: '/campagnes' }],
    suggestions: ['Factures impayées', 'Rapport des panneaux'],
  };
}

async function rapportPanneaux(ctx: Contexte): Promise<ResultatAgent> {
  if (!autorise(ctx, 'emplacements')) return refus('Panneaux');
  const panneaux = await lire(ctx, 'Emplacements');
  const devise = (await ctx.settings.societe()).devise;
  const disponibles = panneaux.filter((p) => p.disponibilite === 'Disponible');
  const parVille = new Map<string, number>();
  for (const p of panneaux) {
    const ville = String(p.ville ?? '—').trim() || '—';
    parVille.set(ville, (parVille.get(ville) ?? 0) + 1);
  }
  const lignes = panneaux.map((p) => [
    p.referenceEmplacement ?? '',
    p.quartier ?? '',
    p.ville ?? '',
    p.type ?? '',
    p.format ?? '',
    argent(p.prixParSemaine, devise),
    p.disponibilite ?? '',
  ]);

  return {
    intention: 'rapport_panneaux',
    texte: `${panneaux.length} panneau(x) : **${disponibles.length} disponible(s)**. Villes : ${[...parVille.entries()].map(([v, n]) => `${v} (${n})`).join(', ')}.`,
    kpis: [
      { libelle: 'Panneaux', valeur: String(panneaux.length) },
      { libelle: 'Disponibles', valeur: String(disponibles.length), ton: 'ok' },
      { libelle: 'Occupés', valeur: String(panneaux.length - disponibles.length) },
      { libelle: 'Villes', valeur: String(parVille.size) },
    ],
    tableau: {
      colonnes: ['Référence', 'Quartier', 'Ville', 'Type', 'Format', 'Prix/sem', 'Disponibilité'],
      lignes,
    },
    export: {
      nom: 'panneaux.csv',
      csv: csv(['Référence', 'Quartier', 'Ville', 'Type', 'Format', 'Prix/sem', 'Disponibilité'], lignes),
    },
    liens: [{ libelle: 'Ouvrir les panneaux', chemin: '/emplacements' }],
    suggestions: ['Panneaux disponibles', 'Réservations en attente'],
  };
}

async function rapportReservations(ctx: Contexte): Promise<ResultatAgent> {
  if (!autorise(ctx, 'reservations')) return refus('Réservations');
  const [reservations, panneaux] = await Promise.all([
    lire(ctx, 'Reservations'),
    lire(ctx, 'Emplacements'),
  ]);
  const nomPanneau = new Map(panneaux.map((p) => [p.id, p.referenceEmplacement ?? '']));
  const enAttente = reservations.filter((r) => r.statut === 'En attente');
  const lignes = reservations.map((r) => {
    const lien = Array.isArray(r.emplacement) ? r.emplacement[0] : r.emplacement;
    return [
      r.referenceReservation ?? '',
      nomPanneau.get(lien) ?? '',
      dateFr(r.dateDebut),
      dateFr(r.dateFin),
      r.statut ?? '',
      nombre(r.montant),
    ];
  });

  return {
    intention: 'rapport_reservations',
    texte: `${reservations.length} réservation(s), dont **${enAttente.length} en attente de confirmation**.`,
    kpis: [
      { libelle: 'Réservations', valeur: String(reservations.length) },
      { libelle: 'En attente', valeur: String(enAttente.length), ton: enAttente.length ? 'attention' : 'ok' },
      { libelle: 'Confirmées', valeur: String(reservations.filter((r) => r.statut === 'Confirmée').length) },
    ],
    tableau: { colonnes: ['Référence', 'Panneau', 'Début', 'Fin', 'Statut', 'Montant'], lignes },
    export: {
      nom: 'reservations.csv',
      csv: csv(['Référence', 'Panneau', 'Début', 'Fin', 'Statut', 'Montant'], lignes),
    },
    liens: [{ libelle: 'Ouvrir les réservations', chemin: '/reservations' }],
    suggestions: ['Panneaux disponibles', 'Résumé du jour'],
  };
}

async function rapportClients(ctx: Contexte): Promise<ResultatAgent> {
  if (!autorise(ctx, 'clients')) return refus('Clients');
  const [clients, campagnes, factures] = await Promise.all([
    lire(ctx, 'Clients'),
    lire(ctx, 'Campagnes'),
    lire(ctx, 'Factures'),
  ]);
  const devise = (await ctx.settings.societe()).devise;
  const parClient = new Map<string, { campagnes: number; facture: number }>();
  for (const c of campagnes) {
    const lien = Array.isArray(c.client) ? c.client[0] : c.client;
    if (!lien) continue;
    const entree = parClient.get(lien) ?? { campagnes: 0, facture: 0 };
    entree.campagnes += 1;
    parClient.set(lien, entree);
  }
  for (const f of factures) {
    const lien = Array.isArray(f.client) ? f.client[0] : f.client;
    if (!lien) continue;
    const entree = parClient.get(lien) ?? { campagnes: 0, facture: 0 };
    entree.facture += nombre(f.montantTtc);
    parClient.set(lien, entree);
  }
  const lignes = clients
    .map((c) => [
      c.nomClient ?? '',
      c.secteurDactivite ?? '',
      String(parClient.get(c.id)?.campagnes ?? 0),
      argent(parClient.get(c.id)?.facture ?? 0, devise),
      c.statut ?? '',
    ])
    .sort((a, b) => nombre(String(b[2])) - nombre(String(a[2])));

  return {
    intention: 'rapport_clients',
    texte: `${clients.length} client(s). Les plus actifs sont en tête du tableau (nombre de campagnes et facturation).`,
    tableau: { colonnes: ['Client', 'Secteur', 'Campagnes', 'Facturé', 'Statut'], lignes },
    export: {
      nom: 'clients.csv',
      csv: csv(['Client', 'Secteur', 'Campagnes', 'Facturé', 'Statut'], lignes),
    },
    liens: [{ libelle: 'Ouvrir les clients', chemin: '/clients' }],
    suggestions: ['Factures impayées', 'Rapport des campagnes'],
  };
}

async function rapportTravaux(ctx: Contexte): Promise<ResultatAgent> {
  if (!autorise(ctx, 'impressions')) return refus('Travaux');
  const travaux = await lire(ctx, 'Impressions');
  const enCours = travaux.filter((t) => t.statut === 'En cours');
  const planifies = travaux.filter((t) => t.statut === 'Planifiée');
  const lignes = travaux.map((t) => [
    t.referenceImpression ?? '',
    t.typeDeTravaux ?? '',
    t.statut ?? '',
    dateFr(t.datePrevue),
    t.machinisteAssigne ?? '',
  ]);

  return {
    intention: 'rapport_travaux',
    texte: `${travaux.length} travail(x) : **${enCours.length} en cours**, ${planifies.length} planifié(s).`,
    kpis: [
      { libelle: 'Travaux', valeur: String(travaux.length) },
      { libelle: 'En cours', valeur: String(enCours.length), ton: 'attention' },
      { libelle: 'Planifiés', valeur: String(planifies.length) },
    ],
    tableau: { colonnes: ['Référence', 'Type', 'Statut', 'Date', 'Machiniste'], lignes },
    export: {
      nom: 'travaux.csv',
      csv: csv(['Référence', 'Type', 'Statut', 'Date', 'Machiniste'], lignes),
    },
    liens: [{ libelle: 'Ouvrir les travaux', chemin: '/impressions' }],
    suggestions: ['Stock en rupture', 'Résumé du jour'],
  };
}

// --- Plan d'action ---------------------------------------------------------
async function resumeJour(ctx: Contexte): Promise<ResultatAgent> {
  const [factures, reservations, stock, campagnes] = await Promise.all([
    autorise(ctx, 'factures') ? lire(ctx, 'Factures') : Promise.resolve([]),
    autorise(ctx, 'reservations') ? lire(ctx, 'Reservations') : Promise.resolve([]),
    autorise(ctx, 'stock') ? lire(ctx, 'Stock') : Promise.resolve([]),
    autorise(ctx, 'campagnes') ? lire(ctx, 'Campagnes') : Promise.resolve([]),
  ]);
  const devise = (await ctx.settings.societe()).devise;
  const aujourd = aujourdHui();
  const retards = factures.filter((f) => f.statutPaiement !== 'Payée' && f.dateEcheance && String(f.dateEcheance) < aujourd);
  const attente = reservations.filter((r) => r.statut === 'En attente');
  const alertes = stock.filter((a) => nombre(a.quantiteEnStock) <= nombre(a.seuilDAlerte) && nombre(a.seuilDAlerte) > 0);
  const aValider = campagnes.filter((c) => c.statut === 'Brouillon' || c.validationCreation === 'En attente');

  const actions: string[] = [];
  if (retards.length) actions.push(`Relancer ${retards.length} facture(s) en retard (${argent(retards.reduce((t, f) => t + nombre(f.montantTtc), 0), devise)}).`);
  if (attente.length) actions.push(`Confirmer ${attente.length} réservation(s) en attente.`);
  if (alertes.length) actions.push(`Réapprovisionner ${alertes.length} article(s) sous le seuil.`);
  if (aValider.length) actions.push(`Valider ${aValider.length} campagne(s) en brouillon.`);
  if (!actions.length) actions.push('Rien d’urgent : tout est à jour.');

  return {
    intention: 'resume',
    texte: `**Plan d'action du ${new Date().toLocaleDateString('fr-FR')}** — ${actions.length} point(s) à traiter.`,
    kpis: [
      { libelle: 'Factures en retard', valeur: String(retards.length), ton: retards.length ? 'danger' : 'ok' },
      { libelle: 'Réservations à confirmer', valeur: String(attente.length), ton: attente.length ? 'attention' : 'ok' },
      { libelle: 'Articles en alerte', valeur: String(alertes.length), ton: alertes.length ? 'attention' : 'ok' },
      { libelle: 'Campagnes à valider', valeur: String(aValider.length) },
    ],
    tableau: { colonnes: ['#', 'Action recommandée'], lignes: actions.map((a, i) => [i + 1, a]) },
    liens: [
      { libelle: 'Facturation', chemin: '/factures' },
      { libelle: 'Réservations', chemin: '/reservations' },
      { libelle: 'Stock', chemin: '/stock' },
    ],
    suggestions: ['Rapport du stock', 'Factures impayées', 'Panneaux disponibles'],
  };
}

// --- Point d'entrée --------------------------------------------------------
export async function repondre(texte: string, ctx: Contexte): Promise<ResultatAgent> {
  const demande = sansAccent(texte);

  // Aide / formation
  if (/(comment|aide|aider|former|formation|explique|tutoriel|ou se trouve|how)/.test(demande)) {
    const aide = reponseAide(texte);
    if (aide) return aide;
  }

  if (/(stock|article|rupture|inventaire|seuil)/.test(demande)) return rapportStock(ctx, demande);
  if (/(facture|impay|retard|recouvrement|paiement)/.test(demande)) return rapportFactures(ctx, demande);
  if (/(campagne|budget|chiffre|ca\b)/.test(demande)) return rapportCampagnes(ctx);
  if (/(panneau|emplacement|disponible|occupe)/.test(demande)) return rapportPanneaux(ctx);
  if (/(reservation|reserver)/.test(demande)) return rapportReservations(ctx);
  if (/(client)/.test(demande)) return rapportClients(ctx);
  if (/(travaux|impression|atelier|soudure|decoration)/.test(demande)) return rapportTravaux(ctx);
  if (/(resume|aujourd|jour|dashboard|situation|etat|priorite|plan d)/.test(demande)) return resumeJour(ctx);

  // Par défaut : plan d'action + suggestions
  const resume = await resumeJour(ctx);
  return {
    ...resume,
    texte: `Je n'ai pas identifié de rapport précis dans « ${texte.trim()} ». Voici la situation du jour :\n\n${resume.texte}`,
    suggestions: [
      'Rapport du stock',
      'Factures impayées',
      'Panneaux disponibles',
      'Réservations en attente',
      'Comment créer une campagne ?',
    ],
  };
}

export const SUGGESTIONS_DEPART = [
  'Résumé du jour',
  'Rapport du stock',
  'Factures impayées',
  'Panneaux disponibles',
  'Réservations en attente',
  'Comment créer une campagne ?',
  'Rapport des campagnes',
  'Top clients',
];
