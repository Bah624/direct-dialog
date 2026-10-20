// Contrôle d'accès serveur : chaque endpoint est rattaché à un module et à une
// action. L'utilisateur authentifié (session) détermine les droits.

import { can, type ModuleKey } from './permissions';
import { settings } from './settings';
import { utilisateurCourant } from './requete';
import type { Utilisateur } from './auth';

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
  getEntrees: { module: 'stock', action: 'voir' },
  entreeStock: { module: 'stock', action: 'gerer' },
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
  reinitialiserMotDePasse: { module: 'utilisateurs', action: 'gerer' },

  // Réglages
  saveParametres: { module: 'parametres', action: 'gerer' },
  exportDonnees: { module: 'parametres', action: 'gerer' },
};

export type UtilisateurActif = Pick<
  Utilisateur,
  'id' | 'nomComplet' | 'email' | 'profil' | 'statut' | 'doitChangerMotDePasse'
>;

export function utilisateurActif(): UtilisateurActif | null {
  const utilisateur = utilisateurCourant();
  if (!utilisateur) return null;
  return {
    id: utilisateur.id,
    nomComplet: utilisateur.nomComplet,
    email: utilisateur.email,
    profil: utilisateur.profil,
    statut: utilisateur.statut,
    doitChangerMotDePasse: Boolean(utilisateur.doitChangerMotDePasse),
  };
}

export async function autoriser(
  endpoint: string,
): Promise<{ autorise: true } | { autorise: false; message: string }> {
  const regle = ENDPOINT_ACCESS[endpoint];
  if (!regle) return { autorise: true };

  const utilisateur = utilisateurCourant();
  if (!utilisateur) return { autorise: false, message: 'Session expirée. Reconnectez-vous.' };
  if (utilisateur.statut === 'Inactif') {
    return { autorise: false, message: 'Ce compte est désactivé.' };
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
