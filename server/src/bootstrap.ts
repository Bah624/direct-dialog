// Démarrage du runtime local avant le chargement des endpoints.
//
// Deux choses doivent être en place AVANT que les modules d'endpoint soient
// évalués :
//   1. les variables d'environnement attendues par le code d'origine ;
//   2. `globalThis.__wrapSdkCall`, le point d'entrée que le SDK `zitejs`
//      utilise pour accéder à la base de données.

import fs from 'node:fs';
import path from 'node:path';
import { Store } from './store';
import { createSdkBridge } from './sdk-bridge';
import { createEmailSender } from './email';
import seed from '../data/seed.json';

export type Runtime = {
  store: Store;
  dataDir: string;
};

export function bootstrap(): Runtime {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  fs.mkdirSync(dataDir, { recursive: true });

  // `voiceAgent.ts` instancie son client OpenAI au chargement du module.
  // Sans clé, le SDK lève une exception et tout le serveur tomberait.
  process.env.ZITE_OPENAI_ACCESS_TOKEN ||= 'sk-local-placeholder';
  // Utilisé dans le lien des e-mails de campagne.
  process.env.ZITE_APP_URL ||= process.env.APP_URL || 'http://localhost:8080';

  const store = new Store({ dir: dataDir, seed: seed as any });
  const sendEmail = createEmailSender(dataDir);

  (globalThis as any).__wrapSdkCall = createSdkBridge({ store, sendEmail });

  return { store, dataDir };
}
