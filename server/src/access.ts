// Contrôle d'accès serveur : chaque endpoint est rattaché à un module et à une
// action. Le profil actif (réglage `profilActifId`) détermine les droits.
//
// L'application est mono-utilisateur : le profil actif est un réglage global,
// choisi dans la barre latérale. L'authentification nominative viendra ensuite.

import { zite } from 'zitejs/db';
import { can, type ModuleKey } from './permissions';
import { settings } from './settings';

type Regle = { module: ModuleKey; action: 'voir' | 'gerer' };

export const ENDPOINT_ACCESS: Record<string, Regle> = {
  // Tableau de bord
  getDashboard: { module: 'dashboard', action: 'voir' },

  // Campagnes
  getCampagnes: { module: 'campagnes', action: 'voir' },
  saveCampagne: { module: 'campagnes', action: 'gerer' },
  deleteCampagne: { module: 'campagnes', action: 'gerer' },

  // Clients
  getClients: { module: 'clients', action: 'voir' },
  saveClient: { module: 'clients', action: 'gerer' },
  deleteClient: { module: 'clients', action: 'gerer' },

  // Emplacements
  getEmplacements: { module: 'emplacements', action: 'voir' },
  saveEmplacement: { module: 'emplacements', action: 'gerer' },
  deleteEmplacement: { module: 'emplacements', action: 'gerer' },

  // Réservations
  getReservations: { module: 'reservations', action: 'voir' },
  saveReservation: { module: 'reservations', action: 'gerer' },
  deleteReservation: { module: 'reservations', action: 'gerer' },

  // Travaux / impressions
  getImpressions: { module: 'impressions', action: 'voir' },
  saveImpression: { module: 'impressions', action: 'gerer' },
  deleteImpression: { module: 'impressions', action: 'gerer' },

  // Facturation
  getFactures: { module: 'factures', action: 'voir' },
  saveFacture: { module: 'factures', action: 'gerer' },
  deleteFacture: { module: 'factures', action: 'gerer' },

  // Stock
  getStock: { module: 'stock', action: 'voir' },
  saveStock: { module: 'stock', action: 'gerer' },
  deleteStock: { module: 'stock', action: 'gerer' },
  getSorties: { module: 'stock', action: 'voir' },
  saveSortie: { module: 'stock', action: 'gerer' },

  // Collaborateurs
  getCollaborateurs: { module: 'collaborateurs', action: 'voir' },
  saveCollaborateur: { module: 'collaborateurs', action: 'gerer' },
  deleteCollaborateur: { module: 'collaborateurs', action: 'gerer' },

  // Rapports et agent
  getReports: { module: 'rapports', action: 'voir' },
  voiceAgent: { module: 'agent', action: 'voir' },

  // Utilisateurs
  getUtilisateurs: { module: 'utilisateurs', action: 'voir' },
  saveUtilisateur: { module: 'utilisateurs', action: 'gerer' },
  deleteUtilisateur: { module: 'utilisateurs', action: 'gerer' },

  // Réglages
  saveParametres: { module: 'parametres', action: 'gerer' },
  exportDonnees: { module: 'parametres', action: 'gerer' },
};

export type UtilisateurActif = {
  id: string;
  nomComplet?: string;
  email?: string;
  profil?: string;
  statut?: string;
};

export async function utilisateurActif(): Promise<UtilisateurActif | null> {
  const id = await settings.profilActifId();
  if (!id) return null;
  return (await zite.utilisateurs.findOne({ id })) ?? null;
}

export async function autoriser(
  endpoint: string,
): Promise<{ autorise: true } | { autorise: false; message: string }> {
  const regle = ENDPOINT_ACCESS[endpoint];
  if (!regle) return { autorise: true };

  const utilisateur = await utilisateurActif();
  // Aucun profil sélectionné (installation neuve) : on ne bloque pas.
  if (!utilisateur) return { autorise: true };
  if (utilisateur.statut === 'Inactif') {
    return { autorise: false, message: 'Ce profil est désactivé.' };
  }
  // Le profil administrateur ne peut pas se verrouiller lui-même hors de l'app.
  if (utilisateur.profil === 'Administrateur') return { autorise: true };

  const permissions = await settings.permissions();
  if (can(permissions, utilisateur.profil, regle.module, regle.action)) {
    return { autorise: true };
  }
  return {
    autorise: false,
    message: `Le profil « ${utilisateur.profil ?? 'inconnu'} » n'a pas les droits requis pour cette action.`,
  };
}
