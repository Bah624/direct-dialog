// Pont entre le SDK `zitejs` et le stockage local.
//
// Le SDK Zite n'exécute rien lui-même : chaque appel `zite.clients.findAll(...)`
// se termine dans `globalThis.__wrapSdkCall(...)`, normalement fourni par le
// worker Zite. On fournit ici notre propre implémentation : c'est ce qui permet
// aux endpoints d'origine (src/api/*.ts) de tourner sans modification, contre
// une base locale.

import type { Store } from './store';
import { TABLES } from './schema';
import type { EmailSender } from './email';

type SdkCall = (
  integrationId: string,
  className: string,
  method: string,
  params: Record<string, any>,
) => Promise<any>;

export function createSdkBridge(options: { store: Store; sendEmail: EmailSender }): SdkCall {
  const { store, sendEmail } = options;

  return async function wrapSdkCall(integrationId, className, method, params = {}) {
    if (integrationId === 'databases') {
      if (className === 'Db') {
        throw new Error(
          'zite.sql() (requête SQL brute) n’est pas disponible dans la version locale. Utilisez les méthodes de table.',
        );
      }
      if (className === 'Auth') {
        if (method === 'findAllUsers') return { users: [] };
        if (method === 'updateUserProfile') return { success: true };
        throw new Error(`Auth.${method} n’est pas implémenté en local.`);
      }

      if (!TABLES[className]) {
        throw new Error(`Table inconnue : « ${className} ».`);
      }

      switch (method) {
        case 'findAll':
          return store.findAll(className, params);
        case 'findOne':
          return store.findOne(className, params);
        case 'create':
          return store.create(className, params);
        case 'update':
          return store.update(className, params);
        case 'delete':
          return store.delete(className, params);
        case 'bulkCreate':
          return store.bulkCreate(className, params);
        default:
          throw new Error(`${className}.${method} n’est pas implémenté en local.`);
      }
    }

    // Envoi d'e-mail : journalisé localement (voir email.ts).
    if (className === 'Email' && method === 'send') {
      return sendEmail(params);
    }

    throw new Error(
      `L’intégration « ${integrationId} » (${className}.${method}) n’est pas branchée en local.`,
    );
  };
}
