const CACHE_NAME = 'dumbkan-v1';
// Allow for dynamic protocol setting based on configuration
self.PREFERRED_PROTOCOL = null; // Will be set via messages from main thread

// Listen for messages from main thread to set protocol preference
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_PROTOCOL') {
        self.PREFERRED_PROTOCOL = event.data.protocol;
        console.log(`[SW] Protocol preference set to: ${self.PREFERRED_PROTOCOL}`);
    }
});

const BASE_PATH = self.location.pathname.replace('sw.js', '');
const ASSETS_TO_CACHE = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'login.html',
    BASE_PATH + 'styles.css',
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
                                cache.put(url, response.clone())
                                    .then(() => console.log(`[SW] Successfully cached ${url}`))
                                    .catch(err => console.error(`[SW] Error caching ${url}:`, err));
                                return response;
                            })
                            .catch(err => {
                                console.error(`[SW] Failed to fetch ${url}:`, err);
                                return Promise.reject(err);
                            })
                    )
                );
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Fetch event - respond with cache then network
self.addEventListener('fetch', function(event) {
    // Parse the URL to determine how to handle the request
    const url = new URL(event.request.url);
    const requestInfo = {
        url: url.toString(),
        protocol: url.protocol,
        hostname: url.hostname,
        pathname: url.pathname,
        isApi: url.pathname.startsWith('/api/')
    };
    
    console.log('[SW] Fetch event for:', url.pathname);
    console.log('[SW] Request info:', requestInfo);
    
    // For API requests or authentication endpoints, bypass cache completely
    // Let these go directly to network to handle authentication properly
    if (requestInfo.isApi || url.pathname === '/verify-pin') {
        console.log('[SW] API or auth request - passing through to network:', url.pathname);
        return; // Let the browser handle this request normally
    }
    
    // For all other requests, use cache-first strategy
    event.respondWith(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            console.log('[SW] Serving from cache:', url.pathname);
                            return cachedResponse;
                        }
                        
                        console.log('[SW] Not in cache, fetching from network:', url.pathname);
                        return fetch(event.request)
                            .then(networkResponse => {
                                // Clone the response so we can return one and cache the other
                                const clonedResponse = networkResponse.clone();
                                
                                // Only cache successful responses
                                if (networkResponse.status === 200) {
                                    // Cache the fetched resource
                                    cache.put(event.request, clonedResponse)
                                        .then(() => {
                                            console.log('[SW] Added to cache:', url.pathname);
                                        })
                                        .catch(error => {
                                            console.error('[SW] Cache add error:', error);
                                        });
                                }
                                
                                return networkResponse;
                            })
                            .catch(error => {
                                console.error('[SW] Network fetch error:', error);
                                // Fall back to a generic offline page if available
                                return caches.match('/offline.html')
                                    .then(offlineResponse => {
                                        return offlineResponse || new Response(
                                            'You are offline and the requested resource is not cached.',
                                            {
                                                status: 503,
                                                headers: {'Content-Type': 'text/plain'}
                                            }
                                        );
                                    });
                            });
                    });
            })
    );
}); 