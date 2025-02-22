/**
 * Base path configuration module
 * Handles the normalization and configuration of the application's base URL path
 * Used for routing and URL construction throughout the application
 */

const config = require('../config');

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Initializes and normalizes the base path for the application
 * @returns {string} The normalized base path
 */
function initializeBasePath() {
    if (!config.BASE_URL) {
        debugLog('No BASE_URL set, using empty base path');
        return '';
    }

    // Clean and normalize the path
    let path = config.BASE_URL;

    // If it's a full URL, extract just the path portion
    try {
        const url = new URL(path);
        path = url.pathname;
    } catch {
        // Not a full URL, treat as a path
        // No action needed as we'll process it as a path
    }

    // Ensure path starts with / if not empty
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }

    // Remove trailing slash if present
    path = path.replace(/\/$/, '');

    debugLog('Base URL Configuration:', {
        originalUrl: config.BASE_URL,
        normalizedPath: path
    });

    return path;
}

// Initialize the base path once and export it
const BASE_PATH = initializeBasePath();

module.exports = BASE_PATH; 