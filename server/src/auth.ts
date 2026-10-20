// Authentification : mots de passe chiffrés (scrypt) et sessions.
//
// - le mot de passe n'est jamais stocké en clair : `scrypt$sel$empreinte` ;
// - le jeton de session n'est jamais stocké en clair non plus : la base garde
//   son empreinte SHA-256, le cookie garde le jeton ;
// - les sessions expirent au bout de 7 jours et sont purgées régulièrement.

import crypto from 'node:crypto';
import { zite } from 'zitejs/db';

export const SESSION_COOKIE = 'dd_session';
export const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export type Utilisateur = {
  id: string;
  nomComplet?: string;
  email?: string;
  telephone?: string;
  profil?: string;
  statut?: string;
  notes?: string;
  motDePasseHash?: string;
  doitChangerMotDePasse?: boolean;
  derniereConnexion?: string;
};

const empreinte = (valeur: string) => crypto.createHash('sha256').update(valeur).digest('hex');

/** Chiffre un mot de passe avec un sel aléatoire. */
export function hasherMotDePasse(motDePasse: string): string {
  const sel = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(motDePasse.normalize('NFKC'), sel, 64).toString('hex');
  return `scrypt$${sel}$${hash}`;
}

/** Vérifie un mot de passe en temps constant. */
export function verifierMotDePasse(motDePasse: string, stocke?: string | null): boolean {
  if (!stocke) return false;
  const [algo, sel, hash] = stocke.split('$');
  if (algo !== 'scrypt' || !sel || !hash) return false;
  const attendu = Buffer.from(hash, 'hex');
  const calcule = crypto.scryptSync(motDePasse.normalize('NFKC'), sel, 64);
  return calcule.length === attendu.length && crypto.timingSafeEqual(calcule, attendu);
}

/** Règles minimales ; renvoie un message d'erreur ou null. */
export function validerMotDePasse(motDePasse: string): string | null {
  if (typeof motDePasse !== 'string' || motDePasse.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (motDePasse.length > 200) return 'Le mot de passe est trop long.';
  return null;
}

export async function creerSession(utilisateurId: string): Promise<{ token: string; expireLe: string }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expireLe = new Date(Date.now() + DUREE_SESSION_MS).toISOString();
  await zite.sessions.create({
    record: { jeton: empreinte(token), utilisateurId, expireLe },
  });
  return { token, expireLe };
}

export async function sessionUtilisateur(token?: string | null): Promise<Utilisateur | null> {
  if (!token) return null;
  const session = await zite.sessions.findOne({ filters: { jeton: empreinte(token) } });
  if (!session) return null;
  if (!session.expireLe || new Date(session.expireLe).getTime() < Date.now()) {
    await zite.sessions.delete({ id: session.id });
    return null;
  }
  const utilisateur = await zite.utilisateurs.findOne({ id: session.utilisateurId });
  if (!utilisateur || utilisateur.statut === 'Inactif') {
    await zite.sessions.delete({ id: session.id });
    return null;
  }
  return utilisateur;
}

export async function detruireSession(token?: string | null): Promise<void> {
  if (!token) return;
  const session = await zite.sessions.findOne({ filters: { jeton: empreinte(token) } });
  if (session) await zite.sessions.delete({ id: session.id });
}

export async function detruireSessionsDe(utilisateurId: string): Promise<void> {
  const { records } = await zite.sessions.findAll({ limit: 2000 });
  for (const session of records) {
    if (session.utilisateurId === utilisateurId) {
      await zite.sessions.delete({ id: session.id });
    }
  }
}

export async function purgerSessions(): Promise<void> {
  const { records } = await zite.sessions.findAll({ limit: 2000 });
  const maintenant = Date.now();
  for (const session of records) {
    if (!session.expireLe || new Date(session.expireLe).getTime() < maintenant) {
      await zite.sessions.delete({ id: session.id });
    }
  }
}

/** Lit un cookie sans dépendance externe. */
export function lireCookie(entete: string | undefined, nom: string): string | undefined {
  if (!entete) return undefined;
  for (const partie of entete.split(';')) {
    const index = partie.indexOf('=');
    if (index === -1) continue;
    const cle = partie.slice(0, index).trim();
    if (cle === nom) return decodeURIComponent(partie.slice(index + 1).trim());
  }
  return undefined;
}
