/**
 * Service Worker for DumbKan
 * Handles offline support and asset caching strategies
 * Provides mechanisms for clean updates and version control
 */

// Version-based cache name - increment this with each significant update
const VERSION = '3';
const CACHE_NAME = `dumbkan-v${VERSION}`;
const API_CACHE_NAME = `dumbkan-api-v${VERSION}`;

// For communicating with the main thread
self.PREFERRED_PROTOCOL = null;

// Debug mode for more verbose logging
const DEBUG = true;

// Message handler for main thread communication
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_PROTOCOL') {
        self.PREFERRED_PROTOCOL = event.data.protocol;
        if (DEBUG) console.log(`[SW] Protocol preference set to: ${self.PREFERRED_PROTOCOL}`);
    }
    
    // Handle skip waiting request (for immediate updates)
    if (event.data && event.data.type === 'SKIP_WAITING') {
        if (DEBUG) console.log('[SW] Skip waiting requested - activating new version immediately');
        self.skipWaiting();
    }

    // Handle debug toggle
    if (event.data && event.data.type === 'SET_DEBUG') {
        if (DEBUG) console.log('[SW] Debug mode set to:', event.data.enabled);
    }
    
    // Handle forced cache clear request
    if (event.data && event.data.type === 'CLEAR_CACHES') {
        if (DEBUG) console.log('[SW] Clearing all caches as requested by client');
        event.waitUntil(
            caches.keys().then(keyList => {
                return Promise.all(keyList.map(key => {
                    if (DEBUG) console.log('[SW] Deleting cache:', key);
                    return caches.delete(key);
                }));
            }).then(() => {
                if (DEBUG) console.log('[SW] All caches cleared');
                // Notify client that caches are cleared
                if (event.source) {
                    event.source.postMessage({
                        type: 'CACHES_CLEARED',
                        timestamp: Date.now()
                    });
                }
            })
        );
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
    BASE_PATH + 'marked.min.js',
    BASE_PATH + 'dumbdateparser.js'
];

// Add offline fallback page
const OFFLINE_PAGE = BASE_PATH + 'offline.html';

// Debug logging
if (DEBUG) {
    console.log('[SW] Service worker v' + VERSION + ' loaded');
    console.log('[SW] Current location:', location.href);
    console.log('[SW] Protocol:', location.protocol);
}

// Install event - cache core assets
self.addEventListener('install', (event) => {
    if (DEBUG) console.log('[SW] Install event for version ' + VERSION);

    // Skip waiting to become active immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                if (DEBUG) console.log('[SW] Caching core assets for version ' + VERSION);
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        fetch(new Request(url), { 
                            cache: 'reload', // Use reload to bypass browser cache
                            credentials: 'same-origin'
                        })
                            .then(response => {
                                if (!response.ok) {
                                    console.warn(`[SW] Failed to fetch ${url}: ${response.status}`);
                                    throw new Error(`Failed to fetch ${url}`);
                                }
                                return cache.put(url, response.clone())
                                    .then(() => {
                                        if (DEBUG) console.log(`[SW] Cached ${url}`);
                                    })
                                    .catch(err => console.error(`[SW] Error caching ${url}:`, err));
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
    if (DEBUG) console.log('[SW] Activate event for version ' + VERSION);
    
    // Claim clients immediately to control pages without reload
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
                        if (DEBUG) console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    }
                }));
            }),
            // Claim all clients
            self.clients.claim().then(() => {
                if (DEBUG) console.log('[SW] Claimed all clients');
                
                // Notify all clients that the service worker has been updated
                return self.clients.matchAll().then(clients => {
                    return Promise.all(clients.map(client => {
                        return client.postMessage({
                            type: 'SW_UPDATED',
                            version: VERSION
                        });
                    }));
                });
            })
        ]).then(() => {
            if (DEBUG) console.log('[SW] Version ' + VERSION + ' now ready to handle fetches');
        })
    );
});

// Helper function to determine if a request should be cached
function shouldCache(url) {
    const parsedUrl = new URL(url);
    
    // Don't cache API requests or auth endpoints
    if (parsedUrl.pathname.startsWith('/api/') || 
        parsedUrl.pathname === '/verify-pin') {
        return false;
    }
    
    // Don't cache query parameters that indicate non-cacheable content
    if (parsedUrl.searchParams.has('no-cache') || 
        parsedUrl.searchParams.has('bypass-cache')) {
        return false;
    }
    
    // Cache static assets and HTML pages
    return true;
}

// Fetch event - implement stale-while-revalidate for most assets
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // For API requests or authentication endpoints, bypass cache completely
    if (!shouldCache(event.request.url)) {
        if (DEBUG && url.pathname.startsWith('/api/')) console.log('[SW] API request - passing through to network:', url.pathname);
        return; // Let the browser handle this request normally
    }
    
    // For all other requests, use stale-while-revalidate strategy
    event.respondWith(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.match(event.request)
                    .then(cachedResponse => {
                        // Create a network request
                        const fetchPromise = fetch(event.request)
                            .then(networkResponse => {
                                // If we got a valid response, cache it for next time
                                if (networkResponse.ok) {
                                    cache.put(event.request, networkResponse.clone())
                                        .catch(err => console.error('[SW] Error updating cache for', url.pathname, err));
                                    if (DEBUG) console.log('[SW] Updated cache for:', url.pathname);
                                }
                                return networkResponse;
                            })
                            .catch(error => {
                                console.error('[SW] Network fetch error:', error);
                                // If offline fallback requested, try to serve it
                                if (event.request.headers.get('Accept')?.includes('text/html')) {
                                    return caches.match(OFFLINE_PAGE)
                                        .then(offlineResponse => {
                                            return offlineResponse || new Response(
                                                'You are offline and the requested resource is not cached.',
                                                {
                                                    status: 503,
                                                    headers: {'Content-Type': 'text/plain'}
                                                }
                                            );
                                        });
                                }
                                throw error;
                            });
                        
                        // Return the cached response if we have one, otherwise wait for the network response
                        return cachedResponse || fetchPromise;
                    });
            })
    );
}); 