// Serveur local de l'application AdCampaign Manager.
//
// Il remplace le runtime Zite :
//   POST /api/<endpoint>                     → exécute src/api/<endpoint>.ts
//   POST /api/v1/zite/public/…/upload-session → upload de fichiers (pièces jointes)
//   GET  /files/<token>/<nom>                 → fichiers envoyés
//   GET  /*                                   → application React compilée (SPA)

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { bootstrap } from './bootstrap';

const { store, dataDir } = bootstrap();

// Les endpoints sont chargés après bootstrap (voir bootstrap.ts).
const { endpoints }: { endpoints: Record<string, any> } = await import('./endpoints.generated');

const PORT = Number(process.env.PORT || 8080);

// Dossier de l'application compilée : `public/` dans l'image Docker, ou le
// `dist/` de Vite quand on lance le serveur depuis le dépôt.
function resolvePublicDir(): string {
  const candidates = [
    process.env.PUBLIC_DIR,
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'apps/adcampaign-manager/dist'),
    path.resolve(process.cwd(), '../apps/adcampaign-manager/dist'),
  ].filter(Boolean) as string[];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? candidates[1];
}

const PUBLIC_DIR = resolvePublicDir();
const UPLOAD_DIR = path.join(dataDir, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));

// ---------------------------------------------------------------------------
// Utilisateur local (l'app d'origine lisait context.user.email dans l'agent IA)
// ---------------------------------------------------------------------------
const localUser = {
  id: 'local-user',
  email: process.env.LOCAL_USER_EMAIL || 'local@hairness.local',
  roles: [] as { id: string }[],
};

// ---------------------------------------------------------------------------
// Upload de fichiers (protocole attendu par zitejs/upload)
// ---------------------------------------------------------------------------
type PendingUpload = { filename: string; contentType: string; size: number; fileUrl: string };
const uploads = new Map<string, PendingUpload>();

const safeName = (name: unknown) =>
  path
    .basename(String(name || 'fichier'))
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120) || 'fichier';

app.post('/api/v1/zite/public/:flowId/upload-session', (req, res) => {
  const { filename, uploadLength, contentType } = req.body ?? {};
  const token = crypto.randomUUID();
  const name = safeName(filename);
  const fileUrl = `/files/${token}/${encodeURIComponent(name)}`;

  uploads.set(token, {
    filename: name,
    contentType: contentType || 'application/octet-stream',
    size: Number(uploadLength) || 0,
    fileUrl,
  });

  res.json({
    success: true,
    presignedUrl: `/api/v1/zite/public/upload/${token}`,
    fileUrl,
    contentType: contentType || 'application/octet-stream',
    completionToken: token,
  });
});

app.put(
  '/api/v1/zite/public/upload/:token',
  express.raw({ type: () => true, limit: '50mb' }),
  (req, res) => {
    const pending = uploads.get(req.params.token);
    if (!pending) {
      res.status(404).json({ success: false, message: 'Session d’envoi inconnue ou expirée.' });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
    fs.writeFileSync(path.join(UPLOAD_DIR, `${req.params.token}-${pending.filename}`), body);
    res.json({ success: true });
  },
);

app.post('/api/v1/zite/public/:flowId/complete-upload', (_req, res) => {
  res.json({ success: true });
});

app.get('/files/:token/:filename', (req, res) => {
  const file = path.join(UPLOAD_DIR, `${safeName(req.params.token)}-${safeName(req.params.filename)}`);
  if (!fs.existsSync(file)) {
    res.status(404).end();
    return;
  }
  res.sendFile(file);
});

// ---------------------------------------------------------------------------
// Exécution des endpoints de l'application
// ---------------------------------------------------------------------------
app.post('/api/:name', async (req, res) => {
  const name = req.params.name;
  const endpoint = endpoints[name];

  if (!endpoint || typeof endpoint.execute !== 'function') {
    res.status(404).json({ message: `Endpoint inconnu : ${name}` });
    return;
  }

  try {
    const input = (req.body && req.body.inputs) ?? {};
    const result = await endpoint.execute({ input, context: { user: localUser, roles: [] } });
    res.json(result);
  } catch (error: any) {
    const status = error?.code === 'BAD_REQUEST' ? 400 : 500;
    console.error(`[api] ${name} → ${error?.message ?? error}`);
    res.status(status).json({
      message: error?.message ?? 'Erreur interne',
      code: error?.code,
      userFacingMessage: error?.userFacingMessage,
    });
  }
});

// ---------------------------------------------------------------------------
// Santé
// ---------------------------------------------------------------------------
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), tables: store.stats() });
});

// ---------------------------------------------------------------------------
// Application React compilée
// ---------------------------------------------------------------------------
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/files/')) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send(
        `Application non compilée.\n\nLancez « yarn build » puis redémarrez, ou utilisez « yarn dev » (Vite + proxy).\nDossier attendu : ${PUBLIC_DIR}`,
      );
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hairness-app] serveur local prêt sur http://localhost:${PORT}`);
  console.log(`[hairness-app] données : ${dataDir}/db.json`);
  console.log(`[hairness-app] endpoints : ${Object.keys(endpoints).length}`);
});
