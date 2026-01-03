const CACHE_NAME = 'job-ecosystem-v3';

// Core assets to cache for offline support
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/dashboard',
  '/assets/css/style.css',
  '/assets/css/preloader.css',
  '/modules/materialize/materialize.min.css',
  '/modules/materialize/materialize.js',
  '/modules/jquery/jquery-2.2.4.min.js',
  '/assets/images/icons/android-icon-192x192.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests (don't cache dynamic data)
  if (event.request.url.includes('/api/')) return;
  
  // For navigation requests, try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then((response) => {
              if (response) return response;
              // Fallback to cached dashboard
              return caches.match('/dashboard');
            });
        })
    );
    return;
  }

  // For static assets, cache first then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        
        return fetch(event.request).then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
  );
});

self.addEventListener('push', e => {
  const data = e.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/assets/images/icons/android-icon-192x192.png',
    data: { url: data.url }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
