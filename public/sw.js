// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — Réussite Magazine
// • Precache du coquille SPA (offline de base)
// • Cache-first : images / fonts / statique
// • Network-first : pages & API (toujours frais si en ligne)
// • Web Push : notifications des nouvelles publications
// ═══════════════════════════════════════════════════════════════
const VERSION = 'reussite-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpe?g|webp|gif|avif|svg|woff2?|mp3|mp4|css|js)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Le proxy audio et les API d'écriture ne passent jamais par le cache.
  if (url.pathname.startsWith('/api/audio-proxy')) return;
  // API back-office & auth : JAMAIS de cache (données privées).
  if (url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/auth')) {
    return; // network-only, sans repli
  }

  // Statique & images : cache-first (performance)
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // API publique : network-first avec repli cache court
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Navigation (SPA) : network-first, coquille en repli hors-ligne
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
  }
});

// ─── Web Push ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Réussite Magazine', body: 'Nouvelle publication disponible.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'reussite-publish',
      data: { url: data.url },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
