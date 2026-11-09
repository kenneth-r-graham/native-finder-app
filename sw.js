// Native Finder web app (and the Android app, which opens it): works offline once visited. The page and its
// catalogs are fetched fresh when online (falling back to the saved copy), so a new release is picked up the next
// time the app opens; scripts (hashed names) are kept after first use, per release (sw.js?v=<version>; older
// releases' are dropped). The big data (dictionary, Korean analyzer model, OCR and its runtime, level check) is kept across releases
// in its own cache: raise DATA when those files change.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `nf-${VERSION}`;
const DATA = 'nf-data-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('nf-') && k !== CACHE && k !== DATA) await caches.delete(k);
    await self.clients.claim();
  })());
});

const fresh = (path) => path.endsWith('/') || path.endsWith('.html') || path.endsWith('.webmanifest') || /\/(catalog|screen|_locales)\//.test(path);
const data = (path) => /\/(dict|kiwi|ocr|ort|levelcheck)\//.test(path);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // The Android app's update file and APK (web/app-update.ts): always from the network, never kept.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/android/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(data(url.pathname) ? DATA : CACHE);
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
