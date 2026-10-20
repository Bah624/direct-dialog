// Démarrage du runtime local avant le chargement des endpoints.
//
// Trois choses doivent être en place AVANT que les modules d'endpoint soient
// évalués :
//   1. les variables d'environnement attendues par le code d'origine ;
//   2. `globalThis.__wrapSdkCall`, le point d'entrée que le SDK `zitejs`
//      utilise pour accéder à la base de données ;
//   3. les données de base : profil administrateur, société, droits.

import fs from 'node:fs';
import path from 'node:path';
import { zite } from 'zitejs/db';
import { Store } from './store';
import { createSdkBridge } from './sdk-bridge';
import { createEmailSender } from './email';
import { settings, DEFAULT_SOCIETE } from './settings';
import { DEFAULT_PERMISSIONS } from './permissions';
import { hasherMotDePasse, purgerSessions } from './auth';
import crypto from 'node:crypto';
import seed from '../data/seed.json';

export type Runtime = {
  store: Store;
  dataDir: string;
};

export async function bootstrap(): Promise<Runtime> {
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

  await seedDefaults();
  await purgerSessions();

  return { store, dataDir };
}

/**
 * Données indispensables au premier démarrage : un profil administrateur, la
 * fiche société et la matrice de droits par défaut.
 */
async function seedDefaults() {
  const { records } = await zite.utilisateurs.findAll({ limit: 10 });

  // Mot de passe administrateur : fourni par l'environnement, sinon généré.
  const motDePasseFourni = process.env.ADMIN_PASSWORD;
  const motDePasse = motDePasseFourni || crypto.randomBytes(9).toString('base64url');

  let administrateur = records[0];
  if (!administrateur) {
    administrateur = await zite.utilisateurs.create({
      record: {
        nomComplet: process.env.ADMIN_NOM || 'Administrateur',
        email: process.env.ADMIN_EMAIL || 'admin@direct-dialog.local',
        telephone: '',
        profil: 'Administrateur',
        statut: 'Actif',
        notes: 'Profil créé automatiquement à l’installation.',
        motDePasseHash: hasherMotDePasse(motDePasse),
        doitChangerMotDePasse: !motDePasseFourni,
      },
    });
    afficherIdentifiants(administrateur.email ?? 'admin@direct-dialog.local', motDePasse, !motDePasseFourni);
  } else if (!administrateur.motDePasseHash) {
    // Mise à niveau d'une installation existante (v1.1 sans mot de passe).
    const motDePasseMigration = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await zite.utilisateurs.update({
      id: administrateur.id,
      record: {
        motDePasseHash: hasherMotDePasse(motDePasseMigration),
        doitChangerMotDePasse: !process.env.ADMIN_PASSWORD,
      },
    });
    afficherIdentifiants(
      administrateur.email ?? 'admin@direct-dialog.local',
      motDePasseMigration,
      !process.env.ADMIN_PASSWORD,
    );
  }

  if (!(await settings.get('permissions', null))) {
    await settings.set('permissions', DEFAULT_PERMISSIONS);
  }
  if (!(await settings.get('societe', null))) {
    await settings.set('societe', DEFAULT_SOCIETE);
  }
}

function afficherIdentifiants(email: string, motDePasse: string, genere: boolean) {
  console.log('[direct-dialog] ─────────────────────────────────────────────');
  console.log('[direct-dialog]  Connexion administrateur');
  console.log(`[direct-dialog]  e-mail       : ${email}`);
  console.log(`[direct-dialog]  mot de passe : ${motDePasse}`);
  if (genere) {
    console.log('[direct-dialog]  (généré automatiquement — à changer après la');
    console.log('[direct-dialog]   première connexion, onglet Paramètres)');
  }
  console.log('[direct-dialog] ─────────────────────────────────────────────');
}
