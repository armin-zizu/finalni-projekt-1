// Service Worker za PWA
const CACHE_NAME = 'office-bar-v2';
const RUNTIME_CACHE = 'office-bar-runtime-v2';

// Fajlovi koji se keširaju pri instalaciji
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/obracun',
  '/cjenovnik',
  '/profile',
  '/login',
  '/manifest.json'
];

// Install event - keširaj fajlove
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching app shell');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { credentials: 'same-origin' })));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - obriši stare cache-ove
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Ignoriši ne-GET zahtjeve
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignoriši Chrome extension zahtjeve
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Za API zahtjeve, koristi network first
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Kloniraj response jer može biti korišten samo jednom
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback na cache ako nema mreže
          return caches.match(event.request);
        })
    );
    return;
  }

  // Za statičke fajlove, koristi cache first
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Provjeri da li je validan response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Kloniraj response
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Ako nema mreže i nema u cache-u, vrati offline stranicu
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

