/**
 * Base path configuration module
 * Handles the normalization and configuration of the application's base URL path
 * Used for routing and URL construction throughout the application
 */

function debugLog(...args) {
    if (process.env.DEBUG === 'TRUE' || process.env.DUMBKAN_DEBUG === 'true') {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Initializes and normalizes the base path for the application
 * @returns {string} The normalized base path
 */
function initializeBasePath() {
    debugLog('Initializing base path from environment:', {
        BASE_URL: process.env.BASE_URL,
        NODE_ENV: process.env.NODE_ENV
    });

    if (!process.env.BASE_URL) {
        debugLog('No BASE_URL set, using empty base path');
        return '';
    }

    let path = process.env.BASE_URL;

    // If it's a full URL, extract just the path portion
    try {
        const url = new URL(path);
        path = url.pathname;
        debugLog('Parsed BASE_URL:', {
            original: process.env.BASE_URL,
            parsed: url,
            extractedPath: path
        });
    } catch (e) {
        debugLog('BASE_URL not a full URL, treating as path:', {
            value: path,
            error: e.message
        });
    }

    // Ensure path starts with / if not empty
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }

    // Remove trailing slash if present
    path = path.replace(/\/$/, '');

    debugLog('Final base path configuration:', {
        originalUrl: process.env.BASE_URL,
        normalizedPath: path
    });

    return path;
}

// Initialize the base path once and export it
const BASE_PATH = initializeBasePath();

module.exports = BASE_PATH; 