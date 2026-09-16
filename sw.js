const CACHE_NAME = 'skeelo-cache-v7';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/db.js',
  './js/model.js',
  './js/logic.js',
  './js/store.js',
  './js/timer.js',
  './js/charts.js',
  './js/utils.js',
  './js/icons.js',
  './js/ui.js',
  './js/habits.js',
  './js/inspirations.js',
  './js/services/auth.js',
  './js/services/auth.local.js',
  './js/services/auth.supabase.js',
  './js/services/supabaseClient.js',
  './js/services/crypto.js',
  './js/views/hoje.js',
  './js/views/jornada.js',
  './js/views/evolucao.js',
  './js/views/fotos.js',
  './js/views/perfil.js',
  './js/views/treino.js',
  './js/views/checkin.js',
  './js/views/resultado.js',
  './js/views/dayDetail.js',
  './js/views/tests.js',
  './js/views/auth.js',
  './js/views/onboarding.js',
  './js/views/evoluir.js',
  './js/views/comunidades.js',
  './js/views/comunidadeDetalhe.js',
  './js/views/desafioDetalhe.js',
  './js/services/communities.js',
  './js/services/admin.js',
  './js/views/admin.js',
  './js/views/progresso.js',
  './js/views/minhaBase.js',
  './js/views/checklist.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  // Supabase (auth/rest/storage) must never be cached: responses are per-user
  // and change constantly, and the Cache API keys on URL only (not headers),
  // so caching them risks serving stale AND cross-account data after reload.
  const isSupabase = url.hostname.endsWith('.supabase.co');

  if (isSupabase) {
    event.respondWith(fetch(req));
  } else if (isSameOrigin) {
    // App shell: cache-first, fall back to network, then to index.html for navigations.
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(res => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            return res;
          })
          .catch(() => {
            if (req.mode === 'navigate') return caches.match('./index.html');
            return cached;
          });
      })
    );
  } else {
    // Cross-origin (fonts): stale-while-revalidate.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req)
            .then(res => { cache.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
