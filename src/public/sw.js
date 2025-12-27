const CACHE_NAME = 'zeno-job-ecosystem-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard',
  '/build/assets/main.js',
  '/build/assets/app-ZxPcUqmw.css',
  '/build/assets/images/brand-logos/toggle-logo.png',
  'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // For navigation requests (HTML pages), try network first, fall back to cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => {
                             if(response) return response;
                             // Fallback to offline page if we had one
                             return caches.match('/dashboard'); 
                        });
                })
        );
        return;
    }

    // For static assets, try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});
