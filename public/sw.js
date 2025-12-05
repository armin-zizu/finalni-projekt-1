// Service Worker za PWA sa automatskim ažuriranjem
// Verzija se automatski ažurira pri svakom deploy-u
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `office-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `office-app-runtime-${CACHE_VERSION}`;

// Resursi koji se cache-uju pri instalaciji
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/obracun',
  '/arhiva',
  '/admin',
  '/profile',
  '/login'
];

// Instalacija Service Workera
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching static assets');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// Aktivacija Service Workera
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Obriši stare cache-ove
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Interceptiranje fetch zahtjeva
self.addEventListener('fetch', (event) => {
  // Preskoči ne-HTTP zahtjeve
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Preskoči Firebase i Google API zahtjeve (uvijek fetch iz mreže)
  if (
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('google.com') ||
    event.request.url.includes('gstatic.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Ako postoji u cache-u, vrati ga
        if (cachedResponse) {
          // U pozadini provjeri da li postoji nova verzija
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {
              // Ignoriraj greške pri background fetch-u
            });
          return cachedResponse;
        }

        // Ako nije u cache-u, fetch iz mreže
        return fetch(event.request)
          .then((response) => {
            // Provjeri da li je validan odgovor
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Kloniraj odgovor
            const responseToCache = response.clone();

            // Spremi u runtime cache
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Ako fetch ne uspije, vrati offline stranicu ako je dostupna
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Message handler za komunikaciju sa klijentom
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Provjeri da li postoji nova verzija
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch('/sw.js', { cache: 'no-store' })
          .then((response) => {
            if (response.status === 200) {
              return response.text();
            }
            return null;
          })
          .then((newSWContent) => {
            if (newSWContent) {
              // Usporedi sa trenutnim service worker-om
              // Ako je različit, postoji nova verzija
              event.ports[0].postMessage({ hasUpdate: true });
            } else {
              event.ports[0].postMessage({ hasUpdate: false });
            }
          })
          .catch(() => {
            event.ports[0].postMessage({ hasUpdate: false });
          });
      })
    );
  }
});

