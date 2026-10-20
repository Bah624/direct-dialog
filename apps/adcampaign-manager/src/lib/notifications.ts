export type Canaux = {
  email: { actif: boolean; destinataires: string[] };
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
  telegram: { actif: boolean; token: string; chatId: string };
  whatsapp: { actif: boolean; token: string; phoneNumberId: string; destinataire: string };
  alerteJours: number;
  heureEnvoi: string;
};

export type AlertePanneau = {
  id: string;
  reference: string;
  quartier: string;
  ville: string;
  localisation: string;
  du: string;
  au: string;
  locationDu: string;
  locationAu: string;
  typePeriode: 'location' | 'disponibilite';
  joursRestants: number;
  etat: 'termine' | 'se_termine' | 'a_venir' | 'disponible';
};

export type HistoriqueNotification = {
  date: string;
  sujet: string;
  nb: number;
  canaux: string;
};

export type EtatNotifications = {
  config: Canaux;
  alertes: AlertePanneau[];
  historique: HistoriqueNotification[];
  dernierEnvoi: string;
};

export const CANAUX_DEFAUT: Canaux = {
  email: { actif: false, destinataires: [] },
  smtp: { host: '', port: 587, secure: false, user: '', pass: '', from: '' },
  telegram: { actif: false, token: '', chatId: '' },
  whatsapp: { actif: false, token: '', phoneNumberId: '', destinataire: '' },
  alerteJours: 7,
  heureEnvoi: '08:00',
};

async function appeler<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api/notifications${chemin}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees?.message ?? `Erreur ${reponse.status}`);
  return donnees as T;
}

export const chargerNotifications = () => appeler<EtatNotifications>('');

export const enregistrerNotifications = (config: Canaux) =>
  appeler<{ config: Canaux }>('', { method: 'PUT', body: JSON.stringify(config) });

export const testerNotification = (canal: 'email' | 'telegram' | 'whatsapp') =>
  appeler<{ resultats: { canal: string; ok: boolean; detail: string }[] }>('/test', {
    method: 'POST',
    body: JSON.stringify({ canal }),
  });

export const envoyerAlertesMaintenant = () =>
  appeler<{
    envoyes: number;
    alertes: AlertePanneau[];
    canaux: { canal: string; ok: boolean; detail: string }[];
    sujet: string;
    texte: string;
  }>('/envoyer', { method: 'POST' });
