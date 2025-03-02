/**
 * Application bootstrap module
 * Provides the application entry point and initialization
 * Detects which page is loaded and initializes the appropriate functionality
 */

// Import application init function
import { init } from './app-init.js';
// Import login functionality
import { initLogin } from './login-utils.js';
// Import UI utilities
import { initCreditVisibility } from './ui-utils.js';

/**
 * Bootstraps the application based on which page is currently loaded
 * Checks if we're on the login page or main application page and initializes accordingly
 */
function bootstrapApplication() {
    if (document.getElementById('pinForm')) {
        // We're on the login page
        console.log('Login page detected');
        // Initialize just login-specific functionality, not the full app
        if (typeof window.initTheme === 'function') {
            window.initTheme();
        }
        // Initialize credit visibility
        initCreditVisibility();
        // Initialize login functionality
        initLogin();
    } else {
        // We're on the main application page
        console.log('Main app page detected');
        init();
    }
}

// Set up the application bootstrap on DOM content loaded
document.addEventListener('DOMContentLoaded', bootstrapApplication);

// Export the bootstrap function for direct usage if needed
export { bootstrapApplication }; 