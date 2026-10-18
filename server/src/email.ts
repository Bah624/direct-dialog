// « Boîte d'envoi » locale : l'application envoie des e-mails depuis
// `saveCampagne` (notification aux collaborateurs). En local, aucun e-mail
// n'est réellement expédié : chaque message est journalisé et archivé dans
// DATA_DIR/outbox.jsonl, ce qui permet de vérifier le contenu.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type EmailSender = (params: Record<string, any>) => Promise<{ success: true; messageId: string }>;

export function createEmailSender(outboxDir: string): EmailSender {
  return async (params) => {
    fs.mkdirSync(outboxDir, { recursive: true });
    const messageId = crypto.randomUUID();
    const record = {
      messageId,
      queuedAt: new Date().toISOString(),
      to: params?.to,
      subject: params?.subject,
      body: params?.body,
    };
    fs.appendFileSync(path.join(outboxDir, 'outbox.jsonl'), JSON.stringify(record) + '\n');
    console.log(`[e-mail local] à ${params?.to ?? '?'} — ${params?.subject ?? '(sans objet)'} (archivé dans outbox.jsonl)`);
    return { success: true, messageId };
  };
}
