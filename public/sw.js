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
    BASE_PATH + 'logo.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Cache each asset individually and ignore failures
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        fetch(new Request(url))
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`Failed to fetch ${url}`);
                                }
                                return cache.put(url, response);
                            })
                            .catch(err => {
                                console.warn(`Failed to cache ${url}:`, err);
                                return null;
                            })
                    )
                );
            })
    );
});

// Activate event - clean up old caches
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
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    const url = new URL(event.request.url);
    if (!['http:', 'https:'].includes(url.protocol)) return;

    // Handle API requests differently
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(JSON.stringify({ error: 'You are offline' }), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 503
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return response;
                    });
            })
    );
}); 