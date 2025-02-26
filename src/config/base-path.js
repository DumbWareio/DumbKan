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
        // If it's not a valid URL, check if it starts with a slash
        // This means it's likely a path like "/kan" and not a domain
        if (path.startsWith('/')) {
            debugLog('BASE_URL appears to be a path:', {
                value: path
            });
        } else if (!path.includes('://')) {
            // If it doesn't include a protocol, it might be just a domain or path
            // Treat as a path if it doesn't contain dots (likely not a domain)
            if (!path.includes('.')) {
                path = '/' + path;
                debugLog('Treating BASE_URL as a path:', {
                    originalValue: process.env.BASE_URL,
                    parsedPath: path
                });
            } else {
                // It has dots, likely a domain without protocol
                debugLog('BASE_URL appears to be a domain without protocol:', {
                    value: path,
                    treatedAs: '/' // we extract just the path, which is '/'
                });
                path = '/';
            }
        } else {
            debugLog('BASE_URL not a full URL, treating as path:', {
                value: path,
                error: e.message
            });
        }
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