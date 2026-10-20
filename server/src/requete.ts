// Contexte de requête : l'utilisateur authentifié est disponible partout dans
// la chaîne d'exécution (guard, endpoints) sans avoir à le passer en paramètre.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Utilisateur } from './auth';

type Contexte = { utilisateur: Utilisateur | null };

const stockage = new AsyncLocalStorage<Contexte>();

export function avecUtilisateur<T>(utilisateur: Utilisateur | null, suite: () => T): T {
  return stockage.run({ utilisateur }, suite);
}

export function utilisateurCourant(): Utilisateur | null {
  return stockage.getStore()?.utilisateur ?? null;
}
