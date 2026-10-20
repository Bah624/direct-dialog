// Profils utilisateurs et matrice de droits.
//
// Chaque module de l'application expose deux actions : consulter (`voir`) et
// modifier (`gerer`). Un profil est un ensemble de droits par module.
// Les droits sont modifiables depuis Paramètres → Rôles & accès.

export const MODULES = [
  'dashboard',
  'campagnes',
  'clients',
  'emplacements',
  'reservations',
  'impressions',
  'factures',
  'stock',
  'collaborateurs',
  'rapports',
  'agent',
  'utilisateurs',
  'parametres',
] as const;

export type ModuleKey = (typeof MODULES)[number];
export type Access = { voir: boolean; gerer: boolean };
export type Permissions = Record<string, Record<ModuleKey, Access>>;

export const PROFILS = [
  'Administrateur',
  'Directeur général',
  'Comptable',
  'RH',
  'Responsable des opérations',
  'Responsable technique',
  'Assistante de direction',
  'Responsable des finances',
  'Secrétaire',
  'Assistante de gestion',
  'Commercial',
  'Soudeur',
  'Décorateur',
  'Graphiste',
  'Machiniste',
  "Chef d'atelier",
] as const;

export type Profil = (typeof PROFILS)[number];

/** Construit une ligne de droits : modules listés en `voir`, sous-ensemble en `gerer`. */
const droits = (voir: ModuleKey[], gerer: ModuleKey[] = []): Record<ModuleKey, Access> =>
  Object.fromEntries(
    MODULES.map((m) => [m, { voir: voir.includes(m), gerer: gerer.includes(m) }]),
  ) as Record<ModuleKey, Access>;

/** Le directeur général voit tout, et ne gère que la validation des campagnes. */
const droitsDirection = (): Record<ModuleKey, Access> =>
  Object.fromEntries(
    MODULES.map((m) => [m, { voir: true, gerer: m === 'campagnes' }]),
  ) as Record<ModuleKey, Access>;

export const DEFAULT_PERMISSIONS: Permissions = {
  Administrateur: Object.fromEntries(
    MODULES.map((m) => [m, { voir: true, gerer: true }]),
  ) as Record<ModuleKey, Access>,

  'Directeur général': droitsDirection(),

  Comptable: droits(
    ['dashboard', 'factures', 'clients', 'campagnes', 'reservations', 'rapports'],
    ['factures'],
  ),

  RH: droits(
    ['dashboard', 'collaborateurs', 'utilisateurs', 'rapports', 'campagnes'],
    ['collaborateurs'],
  ),

  'Responsable des opérations': droits(
    ['dashboard', 'campagnes', 'emplacements', 'reservations', 'impressions', 'stock', 'rapports', 'clients'],
    ['campagnes', 'emplacements', 'reservations', 'impressions', 'stock'],
  ),

  'Responsable technique': droits(
    ['dashboard', 'impressions', 'stock', 'emplacements', 'rapports'],
    ['impressions', 'stock'],
  ),

  'Assistante de direction': droits(
    ['dashboard', 'campagnes', 'clients', 'reservations', 'factures', 'emplacements', 'rapports'],
    ['campagnes', 'clients', 'reservations'],
  ),

  Commercial: droits(
    ['dashboard', 'clients', 'campagnes', 'reservations', 'emplacements', 'rapports'],
    ['clients', 'campagnes', 'reservations'],
  ),

  Graphiste: droits(['dashboard', 'campagnes', 'impressions', 'stock'], ['impressions']),

  Machiniste: droits(['dashboard', 'impressions'], ['impressions']),

  "Chef d'atelier": droits(
    ['dashboard', 'impressions', 'stock', 'collaborateurs', 'rapports'],
    ['impressions', 'stock'],
  ),

  'Responsable des finances': droits(
    ['dashboard', 'factures', 'clients', 'campagnes', 'rapports'],
    ['factures'],
  ),

  Secrétaire: droits(
    ['dashboard', 'clients', 'campagnes', 'reservations', 'factures'],
    ['clients', 'reservations'],
  ),

  'Assistante de gestion': droits(
    ['dashboard', 'campagnes', 'clients', 'reservations', 'impressions', 'stock', 'rapports'],
    ['campagnes', 'reservations'],
  ),

  Soudeur: droits(['dashboard', 'impressions'], ['impressions']),

  'Décorateur': droits(['dashboard', 'impressions', 'stock', 'campagnes'], ['impressions']),
};

export function accessFor(
  permissions: Permissions | undefined,
  profil: string | undefined,
  module: ModuleKey,
): Access {
  const source = permissions ?? DEFAULT_PERMISSIONS;
  return source[profil ?? '']?.[module] ?? { voir: false, gerer: false };
}

export function can(
  permissions: Permissions | undefined,
  profil: string | undefined,
  module: ModuleKey,
  action: 'voir' | 'gerer',
): boolean {
  const access = accessFor(permissions, profil, module);
  return action === 'gerer' ? access.gerer : access.voir;
}
