/**
 * Service Worker for DumbKan
 * Handles offline support and asset caching strategies
 * Provides mechanisms for clean updates and version control
 */

// Version-based cache name - increment this with each significant update
const VERSION = '6';
const CACHE_NAME = `dumbkan-v${VERSION}`;
const API_CACHE_NAME = `dumbkan-api-v${VERSION}`;

// For communicating with the main thread
self.PREFERRED_PROTOCOL = null;
self.CONFIG_BASE_PATH = null;

// Debug mode for more verbose logging
const DEBUG = true;

// Message handler for main thread communication
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_PROTOCOL') {
        self.PREFERRED_PROTOCOL = event.data.protocol;
        if (DEBUG) console.log(`[SW] Protocol preference set to: ${self.PREFERRED_PROTOCOL}`);
    }
    
    // Handle base path configuration from the main thread
    if (event.data && event.data.type === 'SET_BASE_PATH') {
        self.CONFIG_BASE_PATH = event.data.basePath || '';
        if (DEBUG) console.log(`[SW] Base path set by main thread: "${self.CONFIG_BASE_PATH}"`);
        
        // Update the assets to cache with the new base path
        updateAssetsToCache();
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

// Calculate base path more reliably
function calculateBasePath() {
    // If we have a base path from the main thread, use that
    if (self.CONFIG_BASE_PATH !== null) {
        if (DEBUG) console.log('[SW] Using base path from config:', self.CONFIG_BASE_PATH);
        // Remove trailing slash if present - use a more robust regex to remove ALL trailing slashes
        return self.CONFIG_BASE_PATH.replace(/\/+$/, '');
    }
    
    // Get the path of the service worker
    const swPath = self.location.pathname;
    
    // If the service worker is at the root, return '' 
    if (swPath === '/sw.js') {
        return '';
    }
    
    // Extract the base path by removing 'sw.js' from the end
    let basePath = swPath.replace(/\/sw\.js$/, '');
    
    // Remove trailing slash if present - use a more robust regex to remove ALL trailing slashes
    basePath = basePath.replace(/\/+$/, '');
    
    // Debug logging
    if (DEBUG) {
        console.log('[SW] Service worker path:', swPath);
        console.log('[SW] Calculated base path:', basePath);
    }
    
    return basePath;
}

// Initial base path calculation
let BASE_PATH = calculateBasePath();

// Function to construct asset paths with proper base path
function getAssetPath(path) {
    // Recalculate the base path if it might have changed
    BASE_PATH = calculateBasePath();
    
    // Normalize path to ensure it starts with exactly one slash
    const normalizedPath = path.replace(/^\/*/, '/');
    
    // If the base path is empty, just return the normalized path
    if (BASE_PATH === '') {
        return normalizedPath;
    }
    
    // If path already starts with the base path, return as is
    if (path.startsWith(BASE_PATH + '/') || path === BASE_PATH) {
        return path;
    }
    
    // Ensure no double slashes when joining
    const fullPath = BASE_PATH + normalizedPath;
    
    // Log path construction for debugging
    if (DEBUG) {
        console.log('[SW] Path construction:', {
            basePath: BASE_PATH,
            normalizedPath,
            fullPath
        });
    }
    
    return fullPath;
}

// Define offline fallback page
let OFFLINE_PAGE = getAssetPath('/offline.html');

// Define assets to cache with defaults - will be updated when BASE_PATH is known
let ASSETS_TO_CACHE = [];

// Update the assets to cache with the current base path
function updateAssetsToCache() {
    ASSETS_TO_CACHE = [
        getAssetPath('/'),
        getAssetPath('/index.html'),
        getAssetPath('/login.html'),
        getAssetPath('/styles.css'),
        getAssetPath('/manifest.json'),
        getAssetPath('/favicon.svg'),
        getAssetPath('/logo.png'),
        getAssetPath('/marked.min.js'),
        getAssetPath('/dumbdateparser.js')
    ];
    
    // Update offline fallback page
    OFFLINE_PAGE = getAssetPath('/offline.html');
    
    if (DEBUG) {
        console.log('[SW] Updated assets to cache with base path:', BASE_PATH);
        console.log('[SW] Assets to cache:', ASSETS_TO_CACHE);
    }
}

// Initialize assets to cache
updateAssetsToCache();

// Debug logging
if (DEBUG) {
    console.log('[SW] Service worker v' + VERSION + ' loaded');
    console.log('[SW] Current location:', location.href);
    console.log('[SW] Protocol:', location.protocol);
    console.log('[SW] Base path:', BASE_PATH);
    console.log('[SW] Assets to cache:', ASSETS_TO_CACHE);
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
    
    // Don't cache chrome-extension URLs (not supported by Cache API)
    if (parsedUrl.protocol === 'chrome-extension:') {
        if (DEBUG) console.log('[SW] Skipping cache for chrome-extension URL:', parsedUrl.href);
        return false;
    }
    
    // Don't cache API requests or auth endpoints
    // Always recalculate the base path to ensure we have the latest
    const basePath = calculateBasePath();
    const apiPath = basePath + '/api/';
    const verifyPath = basePath + '/verify-pin';
    
    if (parsedUrl.pathname.startsWith(apiPath) || 
        parsedUrl.pathname === verifyPath) {
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

// Helper function to normalize request URLs based on base path
function normalizeRequestUrl(request) {
    const url = new URL(request.url);
    
    // Only process URLs from our domain
    if (url.origin !== location.origin) {
        return request;
    }
    
    // Always recalculate the base path to ensure we have the latest
    const basePath = calculateBasePath();
    
    // If the URL doesn't include our base path and it should, add it
    if (basePath && !url.pathname.startsWith(basePath)) {
        // But don't modify service worker or root page requests
        if (!url.pathname.endsWith('/sw.js') && url.pathname !== '/') {
            const newUrl = new URL(url);
            newUrl.pathname = basePath + url.pathname;
            if (DEBUG) console.log('[SW] Normalizing URL:', { 
                from: url.pathname, 
                to: newUrl.pathname 
            });
            return new Request(newUrl, request);
        }
    }
    
    // Remove double base paths if they exist (a potential issue)
    if (basePath && url.pathname.startsWith(basePath + basePath + '/')) {
        const cleanPath = url.pathname.replace(new RegExp(`^${basePath}${basePath}`), basePath);
        if (DEBUG) console.log('[SW] Fixing double base path:', {
            from: url.pathname,
            to: cleanPath
        });
        const fixedUrl = new URL(url);
        fixedUrl.pathname = cleanPath;
        return new Request(fixedUrl, request);
    }
    
    return request;
}

// Fetch event - implement stale-while-revalidate for most assets
self.addEventListener('fetch', function(event) {
    try {
        // Normalize the request URL
        const normalizedRequest = normalizeRequestUrl(event.request);
        const url = new URL(normalizedRequest.url);
        
        // Skip non-GET requests
        if (normalizedRequest.method !== 'GET') {
            return;
        }
        
        // For API requests or authentication endpoints, bypass cache completely
        if (!shouldCache(normalizedRequest.url)) {
            // Use the latest BASE_PATH calculation
            const basePath = calculateBasePath();
            if (DEBUG && url.pathname.startsWith(basePath + '/api/')) {
                console.log('[SW] API request - passing through to network:', url.pathname);
            }
            return; // Let the browser handle this request normally
        }
        
        // For all other requests, use stale-while-revalidate strategy
        event.respondWith(
            caches.open(CACHE_NAME)
                .then(cache => {
                    return cache.match(normalizedRequest)
                        .then(cachedResponse => {
                            // Create a network request
                            const fetchPromise = fetch(normalizedRequest)
                                .then(networkResponse => {
                                    // If we got a valid response, cache it for next time
                                    if (networkResponse.ok) {
                                        cache.put(normalizedRequest, networkResponse.clone())
                                            .catch(err => console.error('[SW] Error updating cache for', url.pathname, err));
                                        if (DEBUG) console.log('[SW] Updated cache for:', url.pathname);
                                    }
                                    return networkResponse;
                                })
                                .catch(error => {
                                    console.error('[SW] Network fetch error:', error);
                                    // If offline fallback requested, try to serve it
                                    if (normalizedRequest.headers.get('Accept')?.includes('text/html')) {
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
    } catch (error) {
        // Handle any errors in the service worker's fetch handling
        console.error('[SW] Error in fetch handler:', error, 'for URL:', event.request.url);
        // Let the browser handle the request normally
        return;
    }
}); 