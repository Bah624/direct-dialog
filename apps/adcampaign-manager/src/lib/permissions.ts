// Correspondance entre les modules métier, les libellés et les routes.

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  campagnes: 'Campagnes',
  clients: 'Clients',
  emplacements: 'Emplacements',
  reservations: 'Réservations',
  impressions: 'Travaux & impressions',
  factures: 'Facturation',
  stock: 'Gestion des stocks',
  collaborateurs: 'Collaborateurs',
  rapports: 'Rapports',
  agent: 'Agent IA vocal',
  utilisateurs: 'Utilisateurs',
  parametres: 'Paramètres',
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Indicateurs et activité récente',
  campagnes: 'Création, suivi et validation des campagnes',
  clients: 'Fichier clients et prospects',
  emplacements: 'Panneaux, billboards, abribus',
  reservations: 'Réservation des emplacements',
  impressions: 'Travaux d’impression, pose et atelier',
  factures: 'Devis, factures et encaissements',
  stock: 'Articles, seuils et sorties de stock',
  collaborateurs: 'Équipe et notifications',
  rapports: 'Rapports filtrables et impression',
  agent: 'Assistant vocal et transcription',
  utilisateurs: 'Comptes et profils',
  parametres: 'Société, facturation et droits',
};

/** Route → module de droits. */
export const PATH_MODULE: Record<string, string> = {
  '/': 'dashboard',
  '/campagnes': 'campagnes',
  '/clients': 'clients',
  '/emplacements': 'emplacements',
  '/reservations': 'reservations',
  '/impressions': 'impressions',
  '/factures': 'factures',
  '/stock': 'stock',
  '/collaborateurs': 'collaborateurs',
  '/rapports': 'rapports',
  '/agent': 'agent',
  '/parametres': 'parametres',
};

export function moduleForPath(pathname: string): string | undefined {
  if (PATH_MODULE[pathname]) return PATH_MODULE[pathname];
  const match = Object.keys(PATH_MODULE).find(
    (route) => route !== '/' && pathname.startsWith(route),
  );
  return match ? PATH_MODULE[match] : undefined;
}

export function initiales(nom?: string): string {
  if (!nom) return '?';
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('');
}
