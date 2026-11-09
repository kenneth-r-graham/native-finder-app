// Native Finder web app: works offline once visited. The page and its catalog are fetched fresh when online (falling
// back to the saved copy); everything else (scripts with hashed names, the dictionary, the Korean analyzer's model,
// OCR) is kept after the first use. Each release has its own cache (sw.js?v=<version>); older ones are dropped.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `nf-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('nf-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const fresh = (path) => path.endsWith('/') || path.endsWith('.html') || path.endsWith('.webmanifest') || path.includes('/catalog/') || path.includes('/_locales/');

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (fresh(url.pathname) || e.request.mode === 'navigate') {
      try {
        const res = await fetch(e.request);
        if (res.ok) void cache.put(e.request, res.clone());
        return res;
      } catch {
        return (await cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })) ?? Response.error();
      }
    }
    const hit = await cache.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && res.status === 200) void cache.put(e.request, res.clone());
    return res;
  })());
});
