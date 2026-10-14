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
const CACHE_NAME = 'numeros-metalicos-v1.3';

/*
 * Versión de la aplicación derivada automáticamente del nombre del caché.
 * El banner de la página la pide al SW con postMessage y la muestra en un chip.
 * Basta con cambiar CACHE_NAME (p. ej. a 'numeros-metalicos-v3') para que el
 * chip se actualice solo.
 */
const APP_VERSION = CACHE_NAME.split('-').pop();

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

/*
 * Responde a la página con la versión de la app. El chip del banner
 * la usa para mostrarse dinámicamente.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'GET_APP_VERSION') {
    const payload = { type: 'APP_VERSION', version: APP_VERSION, cacheName: CACHE_NAME };
    if (event.ports && event.ports.length > 0) {
      event.ports[0].postMessage(payload);
    } else if (event.source) {
      event.source.postMessage(payload);
    }
  }
});
