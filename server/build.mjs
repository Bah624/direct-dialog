// Compile le serveur local en un seul fichier (server/dist/server.mjs).
//
// Rôle :
//   1. générer server/src/endpoints.generated.ts (un import par endpoint) ;
//   2. regrouper le tout avec esbuild, en résolvant les alias `zitejs/*` vers
//      les fichiers locaux générés par Zite (.zite/db.ts, .zite/backend.ts…),
//      exactement comme le fait vite.config.ts côté client.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = path.resolve(serverDir, '..');
const appDir = path.join(root, 'apps/adcampaign-manager');
const apiDir = path.join(appDir, 'src/api');

// --- 1. endpoints.generated.ts ---------------------------------------------
const endpointFiles = fs
  .readdirSync(apiDir)
  .filter((file) => file.endsWith('.ts'))
  .sort();

const lines = [
  '// Fichier généré par server/build.mjs — ne pas éditer à la main.',
  '',
];
endpointFiles.forEach((file, index) => {
  lines.push(
    `import ep${index} from '../../apps/adcampaign-manager/src/api/${file.replace(/\.ts$/, '')}';`,
  );
});
lines.push('', 'export const endpoints: Record<string, any> = {');
endpointFiles.forEach((file, index) => {
  lines.push(`  ${file.replace(/\.ts$/, '')}: ep${index},`);
});
lines.push('};', '');
fs.writeFileSync(path.join(serverDir, 'src/endpoints.generated.ts'), lines.join('\n'));
console.log(`[build] ${endpointFiles.length} endpoints détectés`);

// --- 2. alias zitejs/* → fichiers locaux -----------------------------------
const zitejsDir = path.join(root, 'node_modules/zitejs/dist/esm');
const aliases = {
  'zitejs/db': path.join(root, '.zite/db.ts'),
  'zitejs/api': path.join(appDir, '.zite/api.ts'),
  'zitejs/backend': path.join(appDir, '.zite/backend.ts'),
  'zitejs/backend/base': path.join(zitejsDir, 'backend/index.js'),
  'zitejs/auth': path.join(zitejsDir, 'auth/index.js'),
  'zitejs/auth/base': path.join(zitejsDir, 'auth/index.js'),
  'zitejs/caller': path.join(zitejsDir, 'caller/index.js'),
  'zitejs/email': path.join(appDir, '.zite/integrations/email.ts'),
  'zitejs/integrations': path.join(appDir, '.zite/integrations/index.ts'),
  'zitejs/meta': path.join(appDir, '.zite/meta.ts'),
};

const aliasPlugin = {
  name: 'zitejs-aliases',
  setup(builder) {
    builder.onResolve({ filter: /^zitejs(\/.*)?$/ }, (args) => {
      const target = aliases[args.path];
      return target ? { path: target } : undefined;
    });
  },
};

// --- 3. bundle --------------------------------------------------------------
await build({
  entryPoints: [path.join(serverDir, 'src/index.ts')],
  outfile: path.join(serverDir, 'dist/server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  // Express et ses dépendances sont des modules CommonJS : on leur fournit un
  // `require` valide dans le bundle ESM.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [aliasPlugin],
  logLevel: 'info',
});

console.log('[build] serveur compilé → server/dist/server.mjs');
