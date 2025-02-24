/**
 * Application configuration and constants
 * Centralizes all configuration values and environment variables
 */

const path = require('path');

// Project name constant
const projectName = 'DumbKan';

// Environment variables
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DUMBKAN_DEBUG === 'true' || process.env.DEBUG === 'TRUE';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Change from dynamic PIN env var to hardcoded one
const PIN = process.env.DUMBKAN_PIN;

// Get site title from environment variable or use default
const SITE_TITLE = process.env.SITE_TITLE || 'DumbKan';

// Base URL configuration
const BASE_PATH = (() => {
    console.log('[DEBUG] Environment variables:', {
        BASE_URL: process.env.BASE_URL,
        NODE_ENV: process.env.NODE_ENV,
        DEBUG: process.env.DEBUG,
        raw_env: process.env
    });

    if (!process.env.BASE_URL) {
        if (DEBUG) console.log('[DEBUG] No BASE_URL set, using empty base path');
        return '';
    }

    let basePath = process.env.BASE_URL;

    // If it's a full URL, extract just the path portion
    try {
        const url = new URL(basePath);
        basePath = url.pathname;
        if (DEBUG) {
            console.log('[DEBUG] Parsed BASE_URL:', {
                original: process.env.BASE_URL,
                parsed: url,
                extractedPath: basePath
            });
        }
    } catch (e) {
        // Not a full URL, treat as a path
        if (DEBUG) {
            console.log('[DEBUG] BASE_URL not a full URL:', {
                value: basePath,
                error: e.message
            });
        }
    }

    // Ensure path starts with / if not empty
    if (basePath && !basePath.startsWith('/')) {
        basePath = '/' + basePath;
    }

    // Remove trailing slash if present
    basePath = basePath.replace(/\/$/, '');

    if (DEBUG) {
        console.log('[DEBUG] Final BASE_PATH configuration:', {
            originalUrl: process.env.BASE_URL,
            normalizedPath: basePath,
            envVars: {
                NODE_ENV: process.env.NODE_ENV,
                DEBUG: process.env.DEBUG
            }
        });
    }

    return basePath;
})();

// Authentication constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

// Data file configuration - use absolute path for Docker environment
const DATA_FILE = '/app/dumbdata/tasks.json';

// Public directory path
const PUBLIC_DIR = path.join(__dirname, '../../public');

console.log('Loading environment configuration:', {
    PORT,
    DEBUG,
    NODE_ENV,
    PIN_ENV_VAR: 'DUMBKAN_PIN',
    PIN_SET: !!process.env.DUMBKAN_PIN,
    PIN_VALUE: process.env.DUMBKAN_PIN ? 'SET' : 'NOT SET',
    SITE_TITLE
});

module.exports = {
    PORT,
    DEBUG,
    NODE_ENV,
    PIN,
    SITE_TITLE,
    BASE_PATH,
    MAX_ATTEMPTS,
    LOCKOUT_TIME,
    DATA_FILE,
    PUBLIC_DIR,
    projectName
}; 