/* NCR Reserves — service worker.
 *
 * Goal: the app shell opens even with zero network (WiFi blip at the
 * restaurant), WITHOUT ever serving stale data or breaking realtime.
 *
 * Strategy:
 *   • Navigations (HTML)      → NETWORK-FIRST. Always try the network so a
 *                               fresh deploy is picked up immediately; fall
 *                               back to the cached shell only when offline.
 *   • Same-origin static GET  → STALE-WHILE-REVALIDATE. Serve the cached
 *     (/assets/*, icons,        copy instantly, refresh it in the background.
 *      manifest, fonts)         Vite asset names are content-hashed, so this
 *                               is always consistent.
 *   • EVERYTHING cross-origin  → not intercepted at all. Supabase REST +
 *     (Supabase, Google Fonts,  realtime (wss), Open-Meteo, Google Fonts all
 *      Open-Meteo)              go straight to the network. We NEVER cache
 *                               API/data responses — no stale reservations.
 *
 * Update flow: skipWaiting only on explicit message from the page (the
 * "Nova versió" toast), then the page reloads on controllerchange. No
 * surprise mid-service asset swaps.
 */
const VERSION    = 'v1';
const CACHE_NAME = `ncr-shell-${VERSION}`;
// Minimal shell precached on install so the very first offline open works.
// Hashed assets are NOT listed here (their names change per build) — they
// populate the cache via stale-while-revalidate on first online load.
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch(() => { /* tolerate a missing entry */ }))
      // Do NOT skipWaiting here — wait for the page's explicit go-ahead.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// The page asks us to activate a freshly-installed worker.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; }
  catch { return false; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET, only same-origin. Everything else (POST, Supabase, fonts,
  // weather API) is left entirely to the browser — never cached.
  if (req.method !== 'GET' || !isSameOrigin(req.url)) return;

  // Navigations → network-first with cached-shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Keep the shell copy current for offline use.
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || (await cache.match('/')) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Same-origin static assets → stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache  = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          // Only cache OK, basic (same-origin) responses.
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);
      return cached || (await network) ||
        new Response('', { status: 504 });
    })()
  );
});
