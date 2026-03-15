// BFW Service Worker v1.28
// Bump this comment with every deploy to ensure SW updates
const CACHE = 'bfw-v5';
const STATIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  // Take over immediately — don't wait for old SW to die
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete ALL old caches
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  // Claim all open tabs immediately
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NEVER cache these — always fetch fresh
  if (
    url.includes('firebaseio.com') ||
    url.includes('cloudinary.com') ||
    url.endsWith('/') ||
    url.includes('index.html') ||
    url.endsWith('manifest.json') ||
    url.endsWith('sw.js')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for stable CDN assets (fonts, Leaflet)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});

// Accept skip-waiting message from page
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
