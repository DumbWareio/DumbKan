// API Utility Functions

// Log initial state
console.log('[Debug] Loading api-utils.js', {
    windowExists: typeof window !== 'undefined',
    hasLoggedFetch: typeof window.loggedFetch === 'function',
    hasApiCall: typeof window.apiCall === 'function'
});

export function loggedFetch(url, options = {}) {
    const method = options.method || 'GET';
    const requestBody = options.body ? JSON.parse(options.body) : null;
    
    // Only log if debugging is enabled
    if (window.appConfig?.debug) {
        console.group(`🌐 API Call: ${method} ${url}`);
        console.log('Request:', {
            method,
            headers: options.headers,
            body: requestBody
        });
    }
    
    return fetch(url, options).then(response => {
        // Only log if debugging is enabled
        if (window.appConfig?.debug) {
            response.clone().json().then(responseData => {
                console.log('Response:', {
                    status: response.status,
                    ok: response.ok,
                    data: responseData
                });
                console.groupEnd();
            }).catch(() => {
                console.log('Response:', {
                    status: response.status,
                    ok: response.ok
                });
                console.groupEnd();
            });
        }
        
        return response;
    }).catch(error => {
        // Always log errors, even if debugging is disabled
        console.error('Error:', error);
        if (window.appConfig?.debug) {
            console.groupEnd();
        }
        throw error;
    });
}

// API call wrapper with retry logic
export function apiCall(url, options = {}) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second
    let attempt = 0;

    const attemptFetch = () => {
        return loggedFetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }).catch(error => {
            attempt++;
            
            if (attempt < MAX_RETRIES) {
                console.warn(`Attempt ${attempt} failed. Retrying...`, error);
                return new Promise(resolve => 
                    setTimeout(() => resolve(attemptFetch()), RETRY_DELAY * attempt)
                );
            }
            
            console.error('Failed to connect to server. Please check your internet connection.');
            throw error;
        });
    };

    return attemptFetch();
}

// Expose the functions globally
window.loggedFetch = loggedFetch;
window.apiCall = apiCall;

// Log final state
console.log('[Debug] Finished loading api-utils.js', {
    hasLoggedFetch: typeof window.loggedFetch === 'function',
    hasApiCall: typeof window.apiCall === 'function'
}); 