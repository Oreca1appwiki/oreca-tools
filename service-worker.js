const CACHE_NAME = 'oreca-tools-v0.5.1';
const CORE = [
  './',
  './index.html',
  './assets/common.css',
  './assets/pwa.js',
  './assets/version.js',
  './damage/',
  './damage/index.html',
  './damage/ui.js',
  './damage/engine.js',
  './kill/',
  './kill/index.html',
  './kill/ui.js',
  './kill/engine.js',
  './kill/presets.js',
  './encounter/',
  './encounter/index.html',
  './encounter/ui.js',
  './encounter/engine.js',
  './encounter/data.js',
  './skill/',
  './skill/index.html',
  './skill/ui.js',
  './skill/engine.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
