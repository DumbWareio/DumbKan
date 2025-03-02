// API Utility Functions

// Log initial state
console.log('[Debug] Loading api-utils.js', {
    windowExists: typeof window !== 'undefined',
    hasLoggedFetch: typeof window.loggedFetch === 'function',
    hasApiCall: typeof window.apiCall === 'function'
});

// Improved fetch function with logging and error handling
function loggedFetch(url, options = {}) {
    console.log('🌐 API Call:', options.method || 'GET', url);
    console.log('Request:', { 
        method: options.method || 'GET', 
        headers: options.headers || {}, 
        body: options.body || null,
        credentials: options.credentials || 'same-origin'
    });
    
    // Ensure credentials are included
    const enhancedOptions = {
        ...options,
        credentials: 'include', // Always include credentials
        redirect: 'follow' // Allow redirects to be followed
    };
    
    console.log('Enhanced options:', enhancedOptions);
    
    return fetch(url, enhancedOptions)
        .then(response => {
            console.log('Raw response:', {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                redirected: response.redirected,
                type: response.type,
                ok: response.ok
            });
            
            // Handle login redirects
            if (response.redirected && response.url.includes('/login.html')) {
                console.log('Detected redirect to login page');
                // Redirect browser to login
                window.location.href = response.url;
                // Throw error to stop further processing
                throw new Error('Authentication required - redirecting to login');
            }

            if (!response.ok) {
                console.log(`${options.method || 'GET'} ${url} ${response.status} (${response.statusText})`);
                
                // For 401 or 403 status codes, redirect to login
                if (response.status === 401 || response.status === 403) {
                    console.log('Authentication failed - redirecting to login');
                    window.location.href = window.appConfig.basePath + '/login.html';
                    throw new Error('Authentication failed');
                }
                
                // For 302 status, follow the redirect
                if (response.status === 302) {
                    console.log('Following redirect from 302 status');
                    const redirectUrl = response.headers.get('Location');
                    return fetch(redirectUrl, enhancedOptions);
                }
                
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Create a clone of the response that maintains the original methods
            // This makes the loggedFetch response compatible with both patterns:
            // 1. Direct use of parsed data (from loggedFetch)
            // 2. Using response.json() again (backward compatibility)
            const clonedResponse = response.clone();
            
            // Parse the response and attach the data to the cloned response
            return response.json().then(data => {
                console.log('Response:', { status: clonedResponse.status, ok: clonedResponse.ok, data });
                
                // Instead of directly assigning to the response object which has read-only properties,
                // create a data property that contains the parsed JSON
                clonedResponse.data = data;
                
                // Override the json method to return the already parsed data
                // This ensures code that calls response.json() again will still work
                const originalJson = clonedResponse.json;
                clonedResponse.json = function() {
                    console.log('Using cached JSON response data');
                    return Promise.resolve(data);
                };
                
                return clonedResponse;
            }).catch(err => {
                console.error('Error parsing JSON:', err);
                // If JSON parsing fails, still return the cloned response
                // This allows callers to handle non-JSON responses properly
                return clonedResponse;
            });
        })
        .catch(error => {
            console.error('Fetch error:', error);
            throw error;
        });
}

// Function to construct full API URLs
function constructApiUrl(url) {
    // If URL is already absolute, return it as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        console.log('[API] URL is already absolute:', url);
        return url;
    }
    
    // Check if appConfig is available
    if (!window.appConfig) {
        console.error('[API] appConfig not available, using relative URL');
        return url;
    }
    
    // Get base URL from config
    const baseUrl = window.appConfig.apiUrl || window.appConfig.basePath || '';
    
    // If URL already starts with a slash, just append it to the base URL
    const fullUrl = url.startsWith('/') 
        ? `${baseUrl}${url}` 
        : `${baseUrl}/${url}`;
        
    console.log('[API] Constructed URL:', { baseUrl, originalUrl: url, fullUrl });
    return fullUrl;
}

// Main API call function
async function apiCall(url, options = {}) {
    const apiUrl = constructApiUrl(url);
    
    // Add JSON content type header if not already set and if we have a body
    if (options.body && !options.headers?.['Content-Type']) {
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
    }
    
    // Always include credentials to ensure cookies are sent
    const enhancedOptions = {
        ...options,
        credentials: 'include'
    };
    
    let attempts = 0;
    const maxAttempts = 3;
    const initialDelay = 500; // ms
    
    async function attemptFetch() {
        try {
            attempts++;
            const result = await loggedFetch(apiUrl, enhancedOptions);
            return result;
        } catch (error) {
            console.log("API call error:", error.message);
            
            // Check for authentication errors - don't retry these
            if (error.message.includes('Authentication required') || 
                error.message.includes('Authentication failed') ||
                error.message.includes('401') ||
                error.message.includes('403')) {
                
                console.log('Authentication error detected - redirecting to login');
                // Redirect to login page if not already there
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = `${window.appConfig.basePath}/login.html`;
                }
                throw error;
            }
            
            // For other errors, implement exponential backoff retry
            if (attempts < maxAttempts) {
                const delay = initialDelay * Math.pow(2, attempts - 1);
                console.log(`Attempt ${attempts} failed. Retrying in ${delay}ms...`, error);
                
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(attemptFetch());
                    }, delay);
                });
            } else {
                console.log('Failed to connect to server. Please check your internet connection.');
                throw error;
            }
        }
    }
    
    return attemptFetch();
}

// Expose the functions globally
window.loggedFetch = loggedFetch;
window.apiCall = apiCall;
window.constructApiUrl = constructApiUrl; // Export the new function

// Log final state
console.log('[Debug] Finished loading api-utils.js', {
    hasLoggedFetch: typeof window.loggedFetch === 'function',
    hasApiCall: typeof window.apiCall === 'function',
    hasConstructApiUrl: typeof window.constructApiUrl === 'function'
}); 