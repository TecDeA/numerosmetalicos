/*
 * Service Worker de "Descubridor de Números Metálicos".
 *
 * Diseñado para convivir con otras aplicaciones alojadas en el mismo
 * dominio de GitHub Pages (p. ej. https://angelmicelti.github.io o
 * https://tecdea.github.io):
 *  - Se registra con scope relativo ('./'), por lo que SOLO controla
 *    las páginas dentro de la carpeta de esta aplicación. Nunca
 *    intercepta peticiones de otras rutas del portal.
 *  - Solo cachea recursos de esta aplicación (mismo scope) y los CDNs
 *    que usa (Tailwind, KaTeX, Google Fonts). Ignora todo lo demás.
 */
/* =========================================================================
 *  Metadatos de versión (semver). Edita aquí en cada release.
 *  - APP_VERSION: cadena de versión mostrada en el chip del header.
 *    Se envía tal cual a la página, así que ya puede incluir la 'v' si
 *    quieres (p. ej. 'v1.4'). La página NO añade ningún prefijo.
 *  - CACHE_NAME: solo se usa para invalidar el caché. Si cambias los
 *    assets, cambia también este nombre (p. ej. 'numeros-metalicos-v3')
 *    para que los usuarios reciban la nueva versión sin tener que
 *    borrar el caché manualmente.
 * ======================================================================= */
const APP_VERSION = 'v1.5';
const APP_BUILD   = '2026-10-14';
const CACHE_NAME  = 'numeros-metalicos-v3';

// Recursos propios de la app (rutas relativas al scope del SW)
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// CDNs externos que la app necesita para funcionar sin conexión
const CDN_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        APP_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key.startsWith('numeros-metalicos-'))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo peticiones GET; ignora el resto (POST, etc.)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  // No tocar nada fuera del scope de esta app, salvo los CDNs conocidos
  const isCdn = CDN_ORIGINS.some((origin) => url.origin === new URL(origin).origin);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) {
    if (!isCdn) return;
  }

  // Navegaciones (recarga de la página): red primero, caché de respaldo
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Recursos estáticos: caché primero, actualizando en segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

/* =========================================================================
 *  Comunicación con la página (postMessage).
 *  - GET_APP_VERSION: responde con la versión + build + cacheName. Lo
 *    usa el chip dinámico del header del index.html.
 *  - SKIP_WAITING:    permite a la página forzar la activación del
 *    nuevo SW sin esperar a que se cierren todas las pestañas.
 *  - PURGE_CACHE:     borra todos los cachés 'numeros-metalicos-*'.
 *    Útil para depuración desde DevTools o un botón "Reset caché".
 * ======================================================================= */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'GET_APP_VERSION') {
    const payload = {
      type: 'APP_VERSION',
      version: APP_VERSION,
      build: APP_BUILD,
      cacheName: CACHE_NAME
    };
    if (event.ports && event.ports.length > 0) {
      event.ports[0].postMessage(payload);
    } else if (event.source) {
      event.source.postMessage(payload);
    }
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'PURGE_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(
          keys.filter((k) => k.startsWith('numeros-metalicos-'))
              .map((k) => caches.delete(k))
        ))
        .then(() => (event.source && event.source.postMessage({ type: 'CACHE_PURGED' })))
    );
    return;
  }
});
