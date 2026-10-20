# DIRECT DIALOG

**Application de gestion pour régie publicitaire** : campagnes, clients, emplacements,
réservations, travaux & impressions, facturation, stock, collaborateurs, rapports et
assistant vocal — avec **gestion des utilisateurs par profil** et **droits d'accès par module**.

[![CI](https://github.com/Bah624/direct-dialog/actions/workflows/ci.yml/badge.svg)](https://github.com/Bah624/direct-dialog/actions/workflows/ci.yml)
[![Release](https://github.com/Bah624/direct-dialog/actions/workflows/release.yml/badge.svg)](https://github.com/Bah624/direct-dialog/actions/workflows/release.yml)
[![Licence : propriétaire](https://img.shields.io/badge/licence-propri%C3%A9taire-black.svg)](LICENSE)

![Tableau de bord](docs/capture-tableau-de-bord.png)

---

## Installation chez un client

Une seule commande, sur une machine équipée de Docker :

```bash
curl -fsSL https://raw.githubusercontent.com/Bah624/direct-dialog/main/install.sh | sh
```

Le script télécharge la dernière version, construit l'image, démarre le service et vérifie
qu'il répond. À la fin : **[http://localhost:8080](http://localhost:8080)**.

Options utiles :

```bash
# Choisir le dossier, le port, ou une version précise
curl -fsSL .../install.sh | sh -s -- --dir /opt/direct-dialog --port 8090 --ref v1.0.0
```

**Mise à jour** : relancer exactement la même commande. Le code est remplacé, les données
sont conservées dans le volume Docker `direct-dialog-data`.

### Première connexion

Au premier démarrage, un compte administrateur est créé. Son mot de passe est soit celui
fourni dans `ADMIN_PASSWORD`, soit généré aléatoirement et affiché dans les journaux :

```bash
docker compose logs app | grep -A5 "Connexion administrateur"
```

Connectez-vous avec `admin@direct-dialog.local`, puis changez le mot de passe dans
**Paramètres → Mon compte**.

### Image publiée (installation instantanée)

Chaque version publiée produit une image sur GitHub Container Registry :

```bash
docker run -d --name direct-dialog -p 8080:8080 \
  -v direct-dialog-data:/app/data \
  ghcr.io/Bah624/direct-dialog:latest
```

> Le paquet `direct-dialog` est public : l'installation par image ne demande aucun
> identifiant. Vérifiable avec `docker pull ghcr.io/Bah624/direct-dialog:latest`.

---

## Démarrage depuis le dépôt

```bash
git clone https://github.com/Bah624/direct-dialog.git
cd direct-dialog
docker compose up -d --build
```

| Commande | Effet |
|---|---|
| `docker compose logs -f app` | journaux |
| `docker compose down` | arrêt (données conservées) |
| `docker compose down -v` | arrêt + remise à zéro des données |
| `curl http://localhost:8080/healthz` | état du service |

Le port est configurable sans éditer le fichier : `DIRECT_DIALOG_PORT=8090 docker compose up -d`.

---

## Développement

Prérequis : Node 22 et Yarn 1.

```bash
yarn install     # une seule fois
yarn dev         # interface sur :8080 (Vite), API sur :8787
```

Build de production local :

```bash
yarn build && yarn start     # http://localhost:8080
```

> Docker et l'instance locale utilisent le même port 8080 : arrêter l'un avant de lancer
> l'autre (`docker compose down` ou `pkill -f "server/dist/server.mjs"`).

---

## Paramètres, utilisateurs et rôles (v1.1)

Un module **Paramètres** est accessible depuis la barre latérale, avec quatre onglets :

| Onglet | Contenu |
|---|---|
| **Général** | Identité de la société (nom, slogan, adresse, téléphone, e-mail, logo), devise et taux de TVA par défaut |
| **Utilisateurs** | Création, modification et suppression des comptes : nom, e-mail, téléphone, profil, statut, notes |
| **Rôles & accès** | Matrice des droits par profil : pour chaque module, autoriser « Voir » et/ou « Gérer » |
| **Système** | Version, profil actif, volumes de données, sauvegarde JSON téléchargeable |

### Profils disponibles

Administrateur · Directeur général · Comptable · RH · Responsable des opérations ·
Responsable technique · Assistante de direction · Commercial · Graphiste · Machiniste ·
Chef d'atelier

Chaque profil reçoit par défaut un périmètre cohérent (le comptable gère la facturation, le
machiniste voit les travaux, le DG consulte tout et ne valide que les campagnes…). Tout est
modifiable dans **Rôles & accès**.

### Fonctionnement

- Le **profil actif** se choisit en bas de la barre latérale (sélecteur visible dès qu'il y a
  plusieurs comptes actifs). Il s'applique immédiatement à l'interface **et** aux appels API.
- Le menu latéral ne montre que les modules autorisés ; un accès direct par URL affiche
  « Accès non autorisé ».
- Les contrôles sont aussi appliqués **côté serveur** : un endpoint refusé renvoie `403`, y
  compris si l'on appelle l'API directement.
- Le profil **Administrateur** conserve toujours l'accès complet et ne peut pas être
  supprimé, rétrogradé ou désactivé s'il est le dernier.
- Au premier démarrage, un profil `Administrateur` est créé automatiquement
  (`admin@direct-dialog.local`) ; vous pouvez le renommer puis créer les comptes de votre
  équipe.

### Authentification

- Chaque utilisateur se connecte avec son **e-mail et son mot de passe**.
- Les mots de passe sont chiffrés en **scrypt** avec un sel aléatoire ; ils ne sont jamais
  stockés ni renvoyés en clair.
- La session repose sur un **cookie HttpOnly** signé (jeton aléatoire dont seule l'empreinte
  SHA-256 est stockée), valable 7 jours, avec expiration côté serveur.
- Après 8 tentatives échouées, la connexion est bloquée 5 minutes.
- Un administrateur peut **réinitialiser** un mot de passe depuis l'onglet Utilisateurs ; les
  sessions ouvertes de l'utilisateur sont alors coupées.
- Chacun change son mot de passe dans **Paramètres → Mon compte**.

---

## Architecture

L'application vient d'un projet Zite : le navigateur appelait `POST /api/<endpoint>` et le
runtime Zite exécutait l'endpoint contre sa base. Cette chaîne est reproduite **sans Zite** :

```
Navigateur (React)
   │  POST /api/<endpoint>            ← zitejs/caller, inchangé
   ▼
server/dist/server.mjs (Express)
   │  exécute src/api/<endpoint>.ts   ← code métier d'origine, inchangé
   ▼
globalThis.__wrapSdkCall              ← pont local (server/src/sdk-bridge.ts)
   │
   ▼
server/src/store.ts  →  /app/data/db.json  (volume Docker)
```

Le code métier (29 endpoints, pages React, composants) n'a pas été réécrit : seul le runtime
a été remplacé. L'image Docker est autonome (bundle serveur + interface compilée, aucune
dépendance externe au démarrage).

### Contenu

```
apps/adcampaign-manager/     interface React (source Zite d'origine, 3 fichiers adaptés)
packages/components/         bibliothèque de composants shadcn/ui
server/
├── src/
│   ├── index.ts             serveur Express : API, envois de fichiers, statique
│   ├── bootstrap.ts         variables d'environnement + branchement du SDK
│   ├── sdk-bridge.ts        implémente zite.<table>.* en local
│   ├── store.ts             stockage (findAll/findOne/create/update/delete/bulkCreate)
│   ├── email.ts             e-mails archivés au lieu d'être envoyés
│   ├── schema.ts            schéma des 10 tables (généré)
│   └── endpoints.generated.ts (généré au build)
├── data/seed.json           données de départ
└── build.mjs                compilation du serveur en un fichier autonome
scripts/dev.sh               lancement sans Docker
install.sh                   installateur client
.github/workflows/           CI (build + tests de fumée) et release (image GHCR)
```

---

## Données

| Quoi | Où |
|---|---|
| Base | volume `direct-dialog-data` → `/app/data/db.json` |
| Pièces jointes, BAT | `/app/data/uploads/` |
| E-mails générés | `/app/data/outbox.jsonl` |

- Au premier démarrage, la base est créée à partir de `server/data/seed.json`.
- **Sauvegarde** :
  ```bash
  docker run --rm -v direct-dialog-data:/data -v "$PWD":/out alpine \
    tar czf /out/sauvegarde-direct-dialog.tgz -C /data .
  ```
- **Restauration** :
  ```bash
  docker run --rm -v direct-dialog-data:/data -v "$PWD":/out alpine \
    sh -c 'rm -rf /data/* && tar xzf /out/sauvegarde-direct-dialog.tgz -C /data'
  ```

### E-mails

L'application envoie un message aux collaborateurs (`notificationsActives = true`) quand une
campagne passe au statut **Validée**. Cette version n'expédie rien : le message est journalisé
et archivé dans `outbox.jsonl` (destinataire, objet, contenu).

### Agent IA vocal

La page « Agent IA Vocal » utilise OpenAI (Whisper + chat + synthèse vocale). Sans clé, elle
affiche une erreur ; le reste de l'application n'est pas affecté.

```bash
ZITE_OPENAI_ACCESS_TOKEN=sk-... docker compose up -d
```

---

## Vérifications effectuées

| Test | Résultat |
|---|---|
| `docker compose up -d` | conteneur `Up (healthy)` sur `0.0.0.0:8080->8080/tcp` |
| Interface (Chrome) | tableau de bord, campagnes, clients, rapports, accès direct aux URL |
| 11 endpoints de lecture | HTTP 200 |
| CRUD (`saveClient`, `saveCampagne`, `deleteClient`, `deleteCampagne`) | persisté |
| Envoi de pièce jointe | fichier stocké puis relu |
| E-mail de validation de campagne | `emailsSent: 1`, archivé dans `outbox.jsonl` |
| Redémarrage du conteneur | données et fichiers conservés |
| `curl /healthz` | `{"status":"ok", …}` |
| Création d'utilisateur + changement de profil | menu filtré (machiniste → Tableau de bord + Travaux) |
| Contrôle d'accès serveur | `getFactures` / `saveParametres` → `403` avec le profil Machiniste |
| Page Paramètres | 5 onglets, 13 modules × 11 profils de droits |
| API sans session | `401` (endpoints et export refusés) |
| Connexion (bon/mauvais mot de passe) | `200` / `401` |
| Changement de mot de passe | ancien refusé, nouveau accepté |
| Déconnexion | session invalidée (`401` ensuite) |

---

## Origine du code

| Élément | Détail |
|---|---|
| Source | projet Zite `8149a78247083f41` (application `ip2kuase4w`), 127 fichiers, `headSha 7c39eeae` |
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| Métier | 29 endpoints d'origine + 6 ajoutés (`src/api/*.ts`) |
| Base | 10 tables d'origine (`zite.schema.json`) + 2 locales (`Utilisateurs`, `Parametres`) |
| Données | 38 enregistrements réels exportés (2 clients, 9 campagnes, 3 emplacements, 6 réservations, 3 impressions, 5 factures, 1 article, 5 sorties, 3 conversations, 1 collaborateur) |

Trois fichiers d'origine ont été adaptés (vérifiable par diff avec la source Zite) :

1. `apps/adcampaign-manager/vite.config.ts` — retrait du plugin `ziteId()` et du script
   `https://zite.com/app-runtime.js`, ajout du proxy de développement, correction de l'alias
   `zitejs/integrations`.
2. `apps/adcampaign-manager/index.html` — titre et favicon locaux.
3. `package.json` — scripts de build, de démarrage et Docker.

Plus l'ajout de `apps/adcampaign-manager/.env` (`VITE_ZITE_API_URL=/api`), requis par le SDK
d'envoi de fichiers.

---

## Limites connues (version de test)

- **HTTPS non fourni** : pour une mise en production, placer l'application derrière un
  reverse proxy TLS et activer `COOKIE_SECURE=1`.
- **Mono-utilisateur** : stockage JSON réécrit à chaque modification (à remplacer par
  PostgreSQL ou SQLite pour une exploitation multi-postes).
- **E-mails non expédiés**, intégrations tierces désactivées (Stripe, Google Maps…), non
  utilisées par le code métier récupéré.
- `zite.sql()` (SQL brut) n'est pas implémenté — aucun endpoint ne l'utilise.

---

## Dépannage

| Symptôme | Solution |
|---|---|
| `port is already allocated` | une instance locale occupe 8080 : `pkill -f "server/dist/server.mjs"` ou `DIRECT_DIALOG_PORT=8090 docker compose up -d` |
| Le démon Docker ne répond plus | disque plein : libérer de l'espace puis relancer Docker Desktop |
| Page blanche / 503 « Application non compilée » | `docker compose build --no-cache` |
| Données à remettre à zéro | `docker compose down -v` puis `docker compose up -d` |
| Voir les erreurs API | `docker compose logs -f app` |

---

## Licence

Logiciel propriétaire — © 2026 DIRECT DIALOG. Tous droits réservés.
Voir [LICENSE](LICENSE).
