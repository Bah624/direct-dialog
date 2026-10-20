// Alertes sur les périodes de disponibilité des panneaux.
//
// Chaque jour à l'heure choisie, le serveur vérifie les panneaux dont la
// période se termine dans les N jours (ou vient de se terminer) et envoie un
// récapitulatif par e-mail, Telegram et WhatsApp.

import type { Store } from './store';
import { Settings } from './settings';
import {
  DEFAULT_CANAUX,
  envoyerSurCanaux,
  normaliserCanaux,
  type Canaux,
  type ResultatCanal,
} from './notifications';

export type AlertePanneau = {
  id: string;
  reference: string;
  quartier: string;
  ville: string;
  localisation: string;
  du: string;
  au: string;
  joursRestants: number;
  etat: 'termine' | 'se_termine' | 'a_venir' | 'disponible';
};

type Ligne = Record<string, any>;

function jourDe(valeur?: string): Date | null {
  if (!valeur) return null;
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function debutDeJour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function analyserPanneaux(rows: Ligne[], alerteJours = 7, aujourdHui = new Date()): AlertePanneau[] {
  const aujourd = debutDeJour(aujourdHui);
  const alertes: AlertePanneau[] = [];

  for (const row of rows) {
    const du = jourDe(row.disponibleDu);
    const au = jourDe(row.disponibleAu);
    if (!du && !au) continue;

    const fin = au ?? du!;
    const joursRestants = Math.round((debutDeJour(fin).getTime() - aujourd.getTime()) / 86_400_000);

    let etat: AlertePanneau['etat'];
    if (joursRestants < 0) etat = 'termine';
    else if (joursRestants <= alerteJours) etat = 'se_termine';
    else if (du && debutDeJour(du) > aujourd) etat = 'a_venir';
    else etat = 'disponible';

    alertes.push({
      id: row.id,
      reference: row.referenceEmplacement ?? 'Panneau',
      quartier: row.quartier ?? '',
      ville: row.ville ?? '',
      localisation: row.localisation ?? '',
      du: row.disponibleDu ?? '',
      au: row.disponibleAu ?? '',
      joursRestants,
      etat,
    });
  }

  return alertes
    .filter((a) => a.etat === 'se_termine' || a.etat === 'termine' || a.etat === 'a_venir')
    .sort((a, b) => a.joursRestants - b.joursRestants);
}

const fmtDate = (valeur: string) => {
  if (!valeur) return '—';
  const [annee, mois, jour] = valeur.split('-');
  return `${jour}/${mois}/${annee}`;
};

export function messageAlertePanneaux(alertes: AlertePanneau[], alerteJours: number) {
  const entete = `Périodes de disponibilité — ${new Date().toLocaleDateString('fr-FR')}`;
  const lignes = alertes.map((a) => {
    const periode = `${fmtDate(a.du)} → ${fmtDate(a.au)}`;
    const lieu = [a.quartier, a.ville].filter(Boolean).join(', ');
    let echeance: string;
    if (a.joursRestants < 0) echeance = `terminée depuis ${Math.abs(a.joursRestants)} jour(s)`;
    else if (a.joursRestants === 0) echeance = "se termine aujourd'hui";
    else echeance = `se termine dans ${a.joursRestants} jour(s)`;
    return `• ${a.reference} — ${lieu}${a.localisation ? ` (${a.localisation})` : ''}\n  ${periode} · ${echeance}`;
  });

  const texte = [
    entete,
    '',
    `${alertes.length} panneau(x) à surveiller (seuil ${alerteJours} jour(s)) :`,
    '',
    ...lignes,
    '',
    '— DIRECT DIALOG',
  ].join('\n');

  return {
    sujet: `[DIRECT DIALOG] ${alertes.length} panneau(x) — fins de disponibilité`,
    texte,
  };
}

export type EnvoiAlertes = {
  envoyes: number;
  alertes: AlertePanneau[];
  canaux: ResultatCanal[];
  sujet: string;
  texte: string;
};

export async function envoyerAlertesPanneaux(options: {
  store: Store;
  settings: Settings;
  archiveEmail?: (params: Record<string, any>) => Promise<any>;
  forcer?: boolean;
}): Promise<EnvoiAlertes> {
  const { store, settings, archiveEmail, forcer } = options;
  const config = normaliserCanaux(await settings.get<Canaux>('notifications', DEFAULT_CANAUX));

  const { records } = await store.findAll('Emplacements', { limit: 1000 });
  const alertes = analyserPanneaux(records as Ligne[], config.alerteJours);
  const { sujet, texte } = messageAlertePanneaux(alertes, config.alerteJours);

  if (alertes.length === 0) {
    return { envoyes: 0, alertes, canaux: [], sujet, texte };
  }

  const canaux = await envoyerSurCanaux(config, sujet, texte, archiveEmail);
  const envoyes = canaux.filter((c) => c.ok).length;

  if (envoyes > 0 || forcer) {
    const aujourd = new Date().toISOString().slice(0, 10);
    const historique = (await settings.get<any[]>('notificationsHistorique', [])) ?? [];
    historique.unshift({
      date: new Date().toISOString(),
      sujet,
      nb: alertes.length,
      canaux: canaux.map((c) => `${c.canal}:${c.ok ? 'ok' : 'échec'}`).join(', '),
    });
    await settings.set('notificationsHistorique', historique.slice(0, 30));
    await settings.set('notificationsDernierEnvoi', aujourd);
  }

  return { envoyes, alertes, canaux, sujet, texte };
}

/** Vérifie l'heure et envoie le récapitulatif une fois par jour. */
export function demarrerPlanificateur(options: {
  store: Store;
  settings: Settings;
  archiveEmail?: (params: Record<string, any>) => Promise<any>;
}) {
  const verifier = async () => {
    try {
      const config = normaliserCanaux(await options.settings.get<Canaux>('notifications', DEFAULT_CANAUX));
      const actif = config.email.actif || config.telegram.actif || config.whatsapp.actif;
      if (!actif) return;

      const maintenant = new Date();
      const [heure, minute] = config.heureEnvoi.split(':').map(Number);
      const aujourd = maintenant.toISOString().slice(0, 10);
      const dernier = await options.settings.get<string>('notificationsDernierEnvoi', '');
      if (dernier === aujourd) return;
      if (maintenant.getHours() * 60 + maintenant.getMinutes() < heure * 60 + minute) return;

      const resultat = await envoyerAlertesPanneaux({
        store: options.store,
        settings: options.settings,
        archiveEmail: options.archiveEmail,
      });
      console.log(
        `[alertes panneaux] ${resultat.alertes.length} alerte(s), ${resultat.envoyes} canal(aux) notifié(s)`,
      );
    } catch (erreur) {
      console.error('[alertes panneaux] échec :', erreur);
    }
  };

  // Toutes les 10 minutes : le contrôle est idempotent (un envoi par jour).
  const minuteur = setInterval(verifier, 10 * 60 * 1000);
  minuteur.unref?.();
  setTimeout(verifier, 20_000).unref?.();
  return minuteur;
}
