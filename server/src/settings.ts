// Réglages de l'application, stockés dans la table « Parametres » (clé/valeur).
//
// Chaque valeur est sérialisée en JSON : un réglage peut donc être un texte, un
// nombre, un objet (société, matrice de droits) ou une liste.

import { zite } from 'zitejs/db';
import { DEFAULT_PERMISSIONS, PROFILS, type Permissions } from './permissions';

export type Societe = {
  nom: string;
  slogan: string;
  adresse: string;
  telephone: string;
  email: string;
  logoUrl: string;
  devise: string;
  tauxTva: number;
};

export const DEFAULT_SOCIETE: Societe = {
  nom: 'DIRECT DIALOG',
  slogan: 'Régie Publicitaire',
  adresse: '',
  telephone: '',
  email: '',
  logoUrl: '',
  devise: 'GNF',
  tauxTva: 18,
};

async function lireTout(): Promise<Record<string, any>> {
  const { records } = await zite.parametres.findAll({ limit: 2000 });
  const out: Record<string, any> = {};
  for (const row of records) {
    if (!row.cle) continue;
    try {
      out[row.cle] = row.valeur == null ? null : JSON.parse(row.valeur);
    } catch {
      out[row.cle] = row.valeur;
    }
  }
  return out;
}

export class Settings {
  private cache: Record<string, any> | null = null;

  private async load(): Promise<Record<string, any>> {
    if (!this.cache) this.cache = await lireTout();
    return this.cache;
  }

  invalidate() {
    this.cache = null;
  }

  async get<T = any>(cle: string, fallback: T): Promise<T> {
    const valeurs = await this.load();
    return (valeurs[cle] ?? fallback) as T;
  }

  async set(cle: string, valeur: any): Promise<void> {
    const serialise = JSON.stringify(valeur ?? null);
    const existant = await zite.parametres.findOne({ filters: { cle } });
    if (existant) {
      await zite.parametres.update({ id: existant.id, record: { cle, valeur: serialise } });
    } else {
      await zite.parametres.create({ record: { cle, valeur: serialise } });
    }
    this.invalidate();
  }

  async all(): Promise<Record<string, any>> {
    return { ...(await this.load()) };
  }

  async societe(): Promise<Societe> {
    const stockee = await this.get<Partial<Societe>>('societe', {});
    return { ...DEFAULT_SOCIETE, ...stockee };
  }

  async permissions(): Promise<Permissions> {
    const stockees = await this.get<Permissions | null>('permissions', null);
    if (!stockees) return DEFAULT_PERMISSIONS;
    // On complète les profils/modules manquants avec les valeurs par défaut.
    const resultat: Permissions = {};
    for (const profil of PROFILS) {
      resultat[profil] = { ...(DEFAULT_PERMISSIONS[profil] ?? {}), ...(stockees[profil] ?? {}) } as any;
    }
    return resultat;
  }

  async profilActifId(): Promise<string | null> {
    return this.get<string | null>('profilActifId', null);
  }
}

export const settings = new Settings();
