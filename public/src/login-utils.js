/**
 * Login utilities module
 * Provides functionality for handling user authentication
 * Manages PIN-based login and verification with improved performance and error handling
 */

import { getStoredAuth, storeAuthData } from './auth-storage.js';

/**
 * Adds visual feedback for login operations
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('loading', 'error', 'success')
 */
function showLoginFeedback(message, type = 'loading') {
    const container = document.querySelector('.pin-input-container');
    if (!container) return;
    
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.login-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `login-feedback login-${type}`;
    feedback.textContent = message;
    feedback.setAttribute('role', 'status');
    
    // Style based on type
    switch (type) {
        case 'loading':
            feedback.style.color = '#2196F3';
            break;
        case 'error':
            feedback.style.color = '#F44336';
            break;
        case 'success':
            feedback.style.color = '#4CAF50';
            break;
    }
    
    // Add to container
    container.appendChild(feedback);
    
    return feedback;
}

/**
 * Initializes the login page functionality
 * Sets up PIN input fields, theme toggle, and PIN verification logic
 * Includes performance optimizations and better error handling
 */
export function initLogin() {
    console.log('initLogin starting...', {
        initThemeExists: typeof window.initTheme === 'function',
        windowKeys: Object.keys(window)
    });
    
    // Initialize theme on login page
    if (typeof window.initTheme === 'function') {
        window.initTheme();
    }
    
    const themeToggleElem = document.getElementById('themeToggle');
    if (themeToggleElem && typeof window.toggleTheme === 'function') {
        themeToggleElem.addEventListener('click', window.toggleTheme);
    }
    
    // Show loading message
    const loadingFeedback = showLoginFeedback('Checking for saved login...', 'loading');
    
    // Add timeout for stored auth check
    const authCheckTimeout = setTimeout(() => {
        console.log('[Login] Auth check timeout - proceeding to PIN input');
        loadingFeedback?.remove();
        initPinInputs();
    }, 3000); // 3 second timeout
    
    // Check for stored PIN first
    getStoredAuth().then(authData => {
        clearTimeout(authCheckTimeout);
        
        if (authData && authData.pin) {
            // Update loading message
            showLoginFeedback('Verifying saved PIN...', 'loading');
            
            // Auto verify the stored PIN
            // Use the API URL from config with its original protocol
            const apiUrl = new URL(window.appConfig.basePath + '/verify-pin', window.appConfig.apiUrl);
            console.log('[Login] Auto-verifying PIN with URL:', apiUrl.toString());
            
            // Add timeout for PIN verification
            const verifyTimeout = setTimeout(() => {
                console.log('[Login] PIN verification timeout - falling back to manual entry');
                showLoginFeedback('Saved login verification timed out', 'error');
                setTimeout(() => initPinInputs(), 1500);
            }, 5000); // 5 second timeout
            
            fetch(apiUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: authData.pin }),
                // Add shorter timeout for fetch operation
                signal: AbortSignal.timeout(4000) // 4 second timeout
            })
            .then(response => response.json())
            .then(result => {
                clearTimeout(verifyTimeout);
                if (result.success) {
                    // Check if we're already being redirected in a loop
                    // Use sessionStorage to track if we've been redirected recently
                    const lastRedirect = sessionStorage.getItem('lastLoginRedirect');
                    const now = Date.now();
                    
                    if (lastRedirect && (now - parseInt(lastRedirect)) < 5000) {
                        console.warn('Potential redirect loop detected. Stopping automatic redirect.');
                        // Clear the session storage to allow future redirects
                        sessionStorage.removeItem('lastLoginRedirect');
                        // Show a message or take alternative action
                        showLoginFeedback('Login successful, but redirect loop detected. Please navigate manually.', 'error');
                        return;
                    }
                    
                    // Store the timestamp of this redirect
                    sessionStorage.setItem('lastLoginRedirect', now.toString());
                    
                    // Show success message before redirect
                    showLoginFeedback('Login successful! Redirecting...', 'success');
                    
                    // Proceed with redirect after short delay for feedback
                    setTimeout(() => {
                        window.location.href = window.appConfig.basePath + '/';
                    }, 500);
                    return;
                }
                // If verification fails, proceed with normal login
                showLoginFeedback('Saved login no longer valid', 'error');
                setTimeout(() => initPinInputs(), 1500);
            })
            .catch((error) => {
                clearTimeout(verifyTimeout);
                console.error('[Login] Error during PIN verification:', error);
                showLoginFeedback('Error verifying login', 'error');
                setTimeout(() => initPinInputs(), 1500);
            });
        } else {
            loadingFeedback?.remove();
            initPinInputs();
        }
    }).catch((error) => {
        clearTimeout(authCheckTimeout);
        console.error('[Login] Error checking stored auth:', error);
        loadingFeedback?.remove();
        initPinInputs();
    });
    
    /**
     * Initializes the PIN input fields and their behavior
     * Creates input boxes based on the required PIN length
     * Handles PIN submission and error display
     */
    function initPinInputs() {
        // For the login page, fetch the PIN length and generate the input boxes
        fetch(window.appConfig.basePath + '/pin-length', {
            // Add timeout for fetch operation
            signal: AbortSignal.timeout(3000) // 3 second timeout
        })
        .then((response) => response.json())
        .then((data) => {
            const pinLength = data.length;
            const container = document.querySelector('.pin-input-container');
            if (container && pinLength > 0) {
                container.innerHTML = ''; // Clear any preexisting inputs
                const inputs = [];
                for (let i = 0; i < pinLength; i++) {
                    const input = document.createElement('input');
                    input.type = 'password';
                    input.inputMode = 'numeric';
                    input.pattern = '[0-9]*';
                    input.classList.add('pin-input');
                    input.maxLength = 1;
                    input.autocomplete = 'off';
                    container.appendChild(input);
                    inputs.push(input);
                }
                
                // Force focus and show keyboard on mobile
                if (inputs.length > 0) {
                    setTimeout(() => {
                        inputs[0].focus();
                        inputs[0].click();
                    }, 100);
                }
                
                inputs.forEach((input, index) => {
                    input.addEventListener('input', () => {
                        if (input.value.length === 1) {
                            if (index < inputs.length - 1) {
                                inputs[index + 1].focus();
                            } else {
                                // Last digit entered, auto submit the PIN via fetch
                                const pin = inputs.map(inp => inp.value).join('');
                                // Use the API URL from config with its original protocol
                                const verifyUrl = new URL(window.appConfig.basePath + '/verify-pin', window.appConfig.apiUrl);
                                
                                console.log('[Login] Verifying PIN with URL:', verifyUrl.toString());
                                showLoginFeedback('Verifying PIN...', 'loading');
                                
                                // Add timeout for PIN verification
                                const verifyTimeout = setTimeout(() => {
                                    console.log('[Login] PIN verification timeout');
                                    showLoginFeedback('Verification timed out. Please try again.', 'error');
                                    // Clear all input fields and refocus the first one
                                    inputs.forEach(inp => inp.value = '');
                                    inputs[0].focus();
                                }, 5000); // 5 second timeout
                                
                                fetch(verifyUrl.toString(), {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pin }),
                                    credentials: 'same-origin', // Include cookies in the request
                                    // Add shorter timeout for fetch operation
                                    signal: AbortSignal.timeout(4000) // 4 second timeout
                                })
                                .then((response) => {
                                    clearTimeout(verifyTimeout);
                                    console.log('[Login] PIN verification response:', {
                                        status: response.status,
                                        ok: response.ok,
                                        redirected: response.redirected,
                                        url: response.url
                                    });
                                    return response.json();
                                })
                                .then((result) => {
                                    console.log('[Login] PIN verification result:', result);
                                    if (result.success) {
                                        showLoginFeedback('PIN verified! Storing login...', 'success');
                                        
                                        // Store the PIN in IndexedDB or localStorage
                                        storeAuthData(pin).then(() => {
                                            // Check for potential redirect loop
                                            const lastRedirect = sessionStorage.getItem('lastLoginRedirect');
                                            const now = Date.now();
                                            
                                            if (lastRedirect && (now - parseInt(lastRedirect)) < 5000) {
                                                console.warn('Potential redirect loop detected. Stopping automatic redirect.');
                                                // Clear session storage to allow future redirects
                                                sessionStorage.removeItem('lastLoginRedirect');
                                                
                                                // Show a success message instead of redirecting
                                                showLoginFeedback(`Login successful! Click <a href='${window.appConfig.basePath}/'>here</a> to continue.`, 'success');
                                                return;
                                            }
                                            
                                            // Store the timestamp of this redirect
                                            sessionStorage.setItem('lastLoginRedirect', now.toString());
                                            
                                            // Show success message before redirect
                                            showLoginFeedback('Login successful! Redirecting...', 'success');
                                            
                                            // Redirect to the index page using the base URL after short delay
                                            setTimeout(() => {
                                                window.location.href = window.appConfig.basePath + '/';
                                            }, 500);
                                        }).catch(error => {
                                            console.error('[Login] Error storing PIN:', error);
                                            // Still redirect even if storing fails
                                            window.location.href = window.appConfig.basePath + '/';
                                        });
                                    } else {
                                        const errorElem = document.querySelector('.pin-error');
                                        if (result.attemptsLeft === 0) {
                                            if (errorElem) {
                                                errorElem.innerHTML = "Too many invalid attempts - 15 minute lockout";
                                                errorElem.setAttribute('aria-hidden', 'false');
                                            }
                                            // Disable all input fields and grey them out
                                            inputs.forEach(inp => {
                                                inp.value = '';
                                                inp.disabled = true;
                                                inp.style.backgroundColor = "#ddd";
                                            });
                                            
                                            showLoginFeedback('Too many invalid attempts. Account locked for 15 minutes.', 'error');
                                        } else {
                                            const invalidAttempt = 5 - (result.attemptsLeft || 0);
                                            if (errorElem) {
                                                errorElem.innerHTML = `Invalid PIN entry ${invalidAttempt}/5`;
                                                errorElem.setAttribute('aria-hidden', 'false');
                                            }
                                            
                                            showLoginFeedback(`Invalid PIN. ${result.attemptsLeft} attempts remaining.`, 'error');
                                            
                                            // Clear all input fields and refocus the first one
                                            inputs.forEach(inp => inp.value = '');
                                            inputs[0].focus();
                                        }
                                    }
                                })
                                .catch((err) => {
                                    clearTimeout(verifyTimeout);
                                    console.error('Error verifying PIN:', err);
                                    showLoginFeedback('Network error. Please try again.', 'error');
                                    // Clear all input fields and refocus the first one
                                    inputs.forEach(inp => inp.value = '');
                                    inputs[0].focus();
                                });
                            }
                        }
                    });
                    
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && input.value === '' && index > 0) {
                            inputs[index - 1].focus();
                        }
                    });
                });
            }
        })
        .catch((err) => {
            console.error('Error fetching PIN length:', err);
            // Show error message when PIN length fetch fails
            showLoginFeedback('Error connecting to server. Please refresh and try again.', 'error');
        });
    }
}

// Make function available on window for backward compatibility
if (typeof window !== 'undefined') {
    window.initLogin = initLogin;
} 