const CACHE_NAME = 'dumbkan-v1';
const BASE_PATH = self.location.pathname.replace('sw.js', '');
const ASSETS_TO_CACHE = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'login.html',
    BASE_PATH + 'styles.css',
    BASE_PATH + 'script.js',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'favicon.svg',
    BASE_PATH + 'logo.png',
    BASE_PATH + 'config.js',
    BASE_PATH + 'marked.min.js',
    BASE_PATH + 'dumbdateparser.js'  // Add missing dependency
];

// Debug logging for service worker
console.log('[SW] Service worker loaded');
console.log('[SW] Current location:', location.href);
console.log('[SW] Protocol:', location.protocol);
console.log('[SW] Assets to cache:', ASSETS_TO_CACHE);

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching assets');
                // Cache each asset individually and ignore failures
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        fetch(new Request(url), { 
                            cache: 'no-cache',
                            credentials: 'same-origin'
                        })
                            .then(response => {
                                if (!response.ok) {
                                    console.warn(`[SW] Failed to fetch ${url}: ${response.status}`);
                                    throw new Error(`Failed to fetch ${url}`);
                                }
                                console.log(`[SW] Successfully cached ${url}`);
                                return cache.put(url, response);
                            })
                            .catch(err => {
                                console.warn(`[SW] Failed to cache ${url}:`, err);
                                return null;
                            })
                    )
                );
            })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all clients
            clients.claim()
        ])
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    console.log('[SW] Fetch event for:', url.pathname);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        console.log('[SW] Non-GET request, passing through:', event.request.method);
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!['http:', 'https:'].includes(url.protocol)) {
        console.log('[SW] Non-HTTP request, ignoring');
        return;
    }

    // For API requests and dumbdateparser.js, try network first, then cache
    if (url.pathname.includes('/api/') || url.pathname.endsWith('/dumbdateparser.js')) {
        console.log('[SW] Network-first request:', url.pathname);
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    console.log('[SW] Network response:', response.status);
                    if (!response.ok) {
                        throw new Error(`Network error: ${response.status}`);
                    }
                    // Clone the response before caching
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            console.log('[SW] Caching successful response:', url.pathname);
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                })
                .catch(error => {
                    console.error('[SW] Network error:', error);
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('[SW] Serving from cache:', url.pathname);
                                return cachedResponse;
                            }
                            // Return offline response
                            return new Response(
                                JSON.stringify({ 
                                    error: 'Network error occurred',
                                    offline: true
                                }), 
                                {
                                    headers: { 'Content-Type': 'application/json' },
                                    status: 503
                                }
                            );
                        });
                })
        );
        return;
    }

    // For all other requests, try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[SW] Serving from cache:', url.pathname);
                    return cachedResponse;
                }

                console.log('[SW] Cache miss, fetching:', url.pathname);
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (!networkResponse.ok) {
                            console.warn('[SW] Network error:', networkResponse.status);
                            throw new Error(`Network error: ${networkResponse.status}`);
                        }

                        // Clone the response before caching
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                console.log('[SW] Caching new resource:', url.pathname);
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    });
            })
            .catch(error => {
                console.error('[SW] Fetch handler error:', error);
                return new Response(
                    'Network error occurred', 
                    { status: 503, statusText: 'Service Unavailable' }
                );
            })
    );
}); 