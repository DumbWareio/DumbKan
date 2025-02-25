/**
 * Login utilities module
 * Provides functionality for handling user authentication
 * Manages PIN-based login and verification
 */

import { getStoredAuth, storeAuthData } from './auth-storage.js';

/**
 * Initializes the login page functionality
 * Sets up PIN input fields, theme toggle, and PIN verification logic
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
    
    // Check for stored PIN first
    getStoredAuth().then(authData => {
        if (authData && authData.pin) {
            // Auto verify the stored PIN
            fetch(window.appConfig.basePath + '/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: authData.pin })
            })
            .then(response => response.json())
            .then(result => {
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
                        const pinContainer = document.querySelector('.pin-input-container');
                        if (pinContainer) {
                            const message = document.createElement('div');
                            message.className = 'redirect-warning';
                            message.textContent = 'Login successful, but redirect loop detected. Please navigate manually.';
                            message.style.color = '#ff4444';
                            message.style.marginTop = '10px';
                            pinContainer.appendChild(message);
                        }
                        return;
                    }
                    
                    // Store the timestamp of this redirect
                    sessionStorage.setItem('lastLoginRedirect', now.toString());
                    
                    // Proceed with redirect
                    window.location.href = window.appConfig.basePath + '/';
                    return;
                }
                // If verification fails, proceed with normal login
                initPinInputs();
            })
            .catch(() => initPinInputs());
        } else {
            initPinInputs();
        }
    }).catch(() => initPinInputs());
    
    /**
     * Initializes the PIN input fields and their behavior
     * Creates input boxes based on the required PIN length
     * Handles PIN submission and error display
     */
    function initPinInputs() {
        // For the login page, fetch the PIN length and generate the input boxes
        fetch(window.appConfig.basePath + '/pin-length')
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
                                fetch(window.appConfig.basePath + '/verify-pin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pin })
                                })
                                .then((response) => response.json())
                                .then((result) => {
                                    if (result.success) {
                                        // Store the PIN in IndexedDB
                                        storeAuthData(pin).then(() => {
                                            // Check for potential redirect loop
                                            const lastRedirect = sessionStorage.getItem('lastLoginRedirect');
                                            const now = Date.now();
                                            
                                            if (lastRedirect && (now - parseInt(lastRedirect)) < 5000) {
                                                console.warn('Potential redirect loop detected. Stopping automatic redirect.');
                                                // Clear session storage to allow future redirects
                                                sessionStorage.removeItem('lastLoginRedirect');
                                                
                                                // Show a success message instead of redirecting
                                                const errorElem = document.querySelector('.pin-error');
                                                if (errorElem) {
                                                    errorElem.innerHTML = "Login successful! Click <a href='" + window.appConfig.basePath + "/'>here</a> to continue.";
                                                    errorElem.style.color = "#4CAF50";
                                                    errorElem.setAttribute('aria-hidden', 'false');
                                                }
                                                return;
                                            }
                                            
                                            // Store the timestamp of this redirect
                                            sessionStorage.setItem('lastLoginRedirect', now.toString());
                                            
                                            // Redirect to the index page using the base URL
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
                                        } else {
                                            const invalidAttempt = 5 - (result.attemptsLeft || 0);
                                            if (errorElem) {
                                                errorElem.innerHTML = `Invalid PIN entry ${invalidAttempt}/5`;
                                                errorElem.setAttribute('aria-hidden', 'false');
                                            }
                                            // Clear all input fields and refocus the first one
                                            inputs.forEach(inp => inp.value = '');
                                            inputs[0].focus();
                                        }
                                    }
                                })
                                .catch((err) => console.error('Error verifying PIN:', err));
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
        .catch((err) => console.error('Error fetching PIN length:', err));
    }
}

// Make function available on window for backward compatibility
if (typeof window !== 'undefined') {
    window.initLogin = initLogin;
} 