// Notifications sortantes : e-mail (SMTP), Telegram et WhatsApp.
//
// Chaque canal est indépendant : un échec n'empêche pas les autres. Les
// réglages sont stockés dans la table Parametres (clé « notifications »).

import nodemailer from 'nodemailer';

export type Canaux = {
  email: { actif: boolean; destinataires: string[] };
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
  telegram: { actif: boolean; token: string; chatId: string };
  whatsapp: { actif: boolean; token: string; phoneNumberId: string; destinataire: string };
  alerteJours: number;
  heureEnvoi: string;
};

export type ResultatCanal = { canal: 'email' | 'telegram' | 'whatsapp'; ok: boolean; detail: string };

export const DEFAULT_CANAUX: Canaux = {
  email: { actif: false, destinataires: [] },
  smtp: { host: '', port: 587, secure: false, user: '', pass: '', from: '' },
  telegram: { actif: false, token: '', chatId: '' },
  whatsapp: { actif: false, token: '', phoneNumberId: '', destinataire: '' },
  alerteJours: 7,
  heureEnvoi: '08:00',
};

export function normaliserCanaux(brut: Partial<Canaux> | null | undefined): Canaux {
  const base = brut ?? {};
  return {
    email: {
      actif: Boolean(base.email?.actif),
      destinataires: Array.isArray(base.email?.destinataires)
        ? base.email!.destinataires.map((e) => String(e).trim()).filter(Boolean)
        : [],
    },
    smtp: {
      host: String(base.smtp?.host ?? ''),
      port: Number(base.smtp?.port ?? 587) || 587,
      secure: Boolean(base.smtp?.secure),
      user: String(base.smtp?.user ?? ''),
      pass: String(base.smtp?.pass ?? ''),
      from: String(base.smtp?.from ?? ''),
    },
    telegram: {
      actif: Boolean(base.telegram?.actif),
      token: String(base.telegram?.token ?? ''),
      chatId: String(base.telegram?.chatId ?? ''),
    },
    whatsapp: {
      actif: Boolean(base.whatsapp?.actif),
      token: String(base.whatsapp?.token ?? ''),
      phoneNumberId: String(base.whatsapp?.phoneNumberId ?? ''),
      destinataire: String(base.whatsapp?.destinataire ?? ''),
    },
    alerteJours: Math.max(0, Math.min(90, Number(base.alerteJours ?? 7))),
    heureEnvoi: /^\d{2}:\d{2}$/.test(String(base.heureEnvoi ?? '')) ? String(base.heureEnvoi) : '08:00',
  };
}

async function envoyerEmail(
  config: Canaux,
  sujet: string,
  texte: string,
  archiveEmail?: (params: Record<string, any>) => Promise<any>,
): Promise<ResultatCanal> {
  if (!config.email.actif) return { canal: 'email', ok: false, detail: 'canal désactivé' };
  const destinataires = config.email.destinataires;
  if (destinataires.length === 0) return { canal: 'email', ok: false, detail: 'aucun destinataire' };

  // Sans serveur SMTP renseigné, le message est archivé localement (outbox).
  if (!config.smtp.host) {
    if (archiveEmail) {
      for (const to of destinataires) {
        await archiveEmail({ to, subject: sujet, body: texte });
      }
      return {
        canal: 'email',
        ok: true,
        detail: `archivé localement (SMTP non configuré) — ${destinataires.length} destinataire(s)`,
      };
    }
    return { canal: 'email', ok: false, detail: 'SMTP non configuré' };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
    await transport.sendMail({
      from: config.smtp.from || config.smtp.user,
      to: destinataires.join(', '),
      subject: sujet,
      text: texte,
    });
    return { canal: 'email', ok: true, detail: `envoyé à ${destinataires.join(', ')}` };
  } catch (erreur: any) {
    return { canal: 'email', ok: false, detail: String(erreur?.message ?? erreur) };
  }
}

async function envoyerTelegram(config: Canaux, texte: string): Promise<ResultatCanal> {
  if (!config.telegram.actif) return { canal: 'telegram', ok: false, detail: 'canal désactivé' };
  if (!config.telegram.token || !config.telegram.chatId) {
    return { canal: 'telegram', ok: false, detail: 'jeton ou chat id manquant' };
  }
  try {
    const reponse = await fetch(
      `https://api.telegram.org/bot${config.telegram.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text: texte,
          disable_web_page_preview: true,
        }),
      },
    );
    const donnees: any = await reponse.json().catch(() => ({}));
    if (!reponse.ok || donnees?.ok === false) {
      return { canal: 'telegram', ok: false, detail: String(donnees?.description ?? `HTTP ${reponse.status}`) };
    }
    return { canal: 'telegram', ok: true, detail: 'message envoyé' };
  } catch (erreur: any) {
    return { canal: 'telegram', ok: false, detail: String(erreur?.message ?? erreur) };
  }
}

async function envoyerWhatsApp(config: Canaux, texte: string): Promise<ResultatCanal> {
  if (!config.whatsapp.actif) return { canal: 'whatsapp', ok: false, detail: 'canal désactivé' };
  const { token, phoneNumberId, destinataire } = config.whatsapp;
  if (!token || !phoneNumberId || !destinataire) {
    return { canal: 'whatsapp', ok: false, detail: 'jeton, identifiant ou destinataire manquant' };
  }
  try {
    const reponse = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destinataire,
        type: 'text',
        text: { body: texte },
      }),
    });
    const donnees: any = await reponse.json().catch(() => ({}));
    if (!reponse.ok || donnees?.error) {
      return {
        canal: 'whatsapp',
        ok: false,
        detail: String(donnees?.error?.message ?? `HTTP ${reponse.status}`),
      };
    }
    return { canal: 'whatsapp', ok: true, detail: 'message envoyé' };
  } catch (erreur: any) {
    return { canal: 'whatsapp', ok: false, detail: String(erreur?.message ?? erreur) };
  }
}

export async function envoyerSurCanaux(
  config: Canaux,
  sujet: string,
  texte: string,
  archiveEmail?: (params: Record<string, any>) => Promise<any>,
): Promise<ResultatCanal[]> {
  const resultats: ResultatCanal[] = [];
  resultats.push(await envoyerEmail(config, sujet, texte, archiveEmail));
  resultats.push(await envoyerTelegram(config, `${sujet}\n\n${texte}`));
  resultats.push(await envoyerWhatsApp(config, `${sujet}\n\n${texte}`));
  return resultats.filter((r) => r.detail !== 'canal désactivé');
}

export const MESSAGE_TEST = [
  'DIRECT DIALOG — test de notification',
  '',
  'Ce message confirme que le canal est correctement configuré.',
  `Envoyé le ${new Date().toLocaleString('fr-FR')}.`,
].join('\n');
