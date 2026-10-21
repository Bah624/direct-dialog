// Service worker minimal : coque de l'application mise en cache pour un
// démarrage rapide et un écran hors ligne. Les appels /api ne sont jamais
// servis depuis le cache.
const CACHE = 'direct-dialog-v1';
const COQUE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(COQUE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/files/')) return;

  // Navigation : réseau d'abord, coque en secours.
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      fetch(requete).catch(() =>
        caches.match('/index.html').then((reponse) => reponse ?? Response.error()),
      ),
    );
    return;
  }

  // Ressources : cache d'abord, puis réseau (et mise en cache).
  evenement.respondWith(
    caches.match(requete).then(
      (enCache) =>
        enCache ??
        fetch(requete).then((reponse) => {
          if (reponse.ok && (url.pathname.startsWith('/assets/') || /\.(png|svg|woff2?)$/.test(url.pathname))) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        }),
    ),
  );
});
