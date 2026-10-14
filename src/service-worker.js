// Build placeholders are replaced by the Vite plugin with this build's files.
const PREFIX = `pocket-club:${self.registration.scope}:`;
const CACHE = PREFIX + __CACHE_VERSION__;
const FILES = __PRECACHE_FILES__.map((file) => new URL(file, self.registration.scope).href);
const APP = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  // Updates wait until existing app windows close; never interrupt a match.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const key = url.origin + url.pathname;
  const home = key === self.registration.scope || key === APP;
  const resource = event.request.mode === 'navigate' && home ? APP : key;
  if (!FILES.includes(resource)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(resource) || fetch(event.request);
  })());
});
