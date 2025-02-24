// API Utility Functions

function loggedFetch(url, options = {}) {
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

// Expose the function globally
window.loggedFetch = loggedFetch; 