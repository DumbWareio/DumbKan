/**
 * Authentication module
 * Handles PIN-based authentication, brute force protection, and session management
 */

const crypto = require('crypto');
const path = require('path');
const config = require('../config');

// Brute force protection
const loginAttempts = new Map();

// At the top after imports
const publicPaths = [
    '/login',
    '/login.html',
    '/pin-length',
    '/verify-pin',
    '/styles.css',
    '/sw.js',
    '/config.js',
    '/dumbdateparser.js',
    '/manifest.json',
    '/favicon.svg',
    '/logo.png',
    '/marked.min.js',
    '/src/',  // Allow access to src directory
    '/icons/'  // Allow access to icons directory
];

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

function resetAttempts(ip) {
    debugLog('Resetting login attempts for IP:', ip);
    loginAttempts.delete(ip);
}

function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= config.MAX_ATTEMPTS) {
        const timeElapsed = Date.now() - attempts.lastAttempt;
        if (timeElapsed < config.LOCKOUT_TIME) {
            debugLog('IP is locked out:', ip, 'Time remaining:', Math.ceil((config.LOCKOUT_TIME - timeElapsed) / 1000 / 60), 'minutes');
            return true;
        }
        resetAttempts(ip);
    }
    return false;
}

function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
    debugLog('Login attempt recorded for IP:', ip, 'Count:', attempts.count);
}

// Constant-time PIN comparison to prevent timing attacks
function verifyPin(storedPin, providedPin) {
    if (!storedPin || !providedPin) return false;
    if (providedPin.length !== storedPin.length) {
        // Perform a dummy comparison to simulate constant-time delay
        try {
            crypto.timingSafeEqual(Buffer.from(storedPin), Buffer.from(storedPin));
        } catch (error) {
            // noop
        }
        return false;
    }
    try {
        return crypto.timingSafeEqual(
            Buffer.from(storedPin),
            Buffer.from(providedPin)
        );
    } catch {
        return false;
    }
}

// Authentication middleware
const authMiddleware = (req, res, next) => {
    debugLog('🔐 Auth Check:', {
        path: req.path,
        session: {
            exists: !!req.session,
            authenticated: req.session?.authenticated
        },
        pin: {
            configured: !!config.PIN,
            length: config.PIN?.length
        }
    });
    
    // If no PIN is set, bypass authentication
    if (!config.PIN || config.PIN.trim() === '') {
        debugLog('Auth bypassed - No PIN configured');
        return next();
    }

    // Check if user is authenticated via session
    if (!req.session.authenticated) {
        debugLog('Auth failed - No valid session, redirecting to login');
        // Make sure we're using the full path with BASE_PATH
        return res.redirect(`${config.BASE_PATH}/login.html`);
    }
    
    debugLog('Auth successful - Valid session found');
    next();
};

// Start cleanup interval for old lockouts
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= config.LOCKOUT_TIME) {
            loginAttempts.delete(ip);
        }
    }
}, 60000); // Clean up every minute

// Add these helper functions:
function getLastAttemptTime(ip) {
    const attempts = loginAttempts.get(ip);
    return attempts ? attempts.lastAttempt : 0;
}

function getAttemptCount(ip) {
    const attempts = loginAttempts.get(ip);
    return attempts ? attempts.count : 0;
}

// Add a function to check if a path is public
function isPublicPath(path) {
    // Check if path starts with /src/ or matches other public paths
    if (path.startsWith('/src/')) return true;
    return publicPaths.some(p => path === p || path.endsWith(p));
}

// Add a function to protect routes
function protectRoute(req, res, next) {
    const isApiRequest = req.path.startsWith('/api/');
    const isPublic = isPublicPath(req.path);
    
    debugLog('🛡️ Protection Check:', {
        path: req.path,
        isPublic,
        isApiRequest,
        session: {
            exists: !!req.session,
            authenticated: req.session?.authenticated
        },
        matchedPublicPath: isPublic ? publicPaths.find(p => req.path === p || req.path.endsWith(p)) : null,
        decision: isPublic ? 'allow' : 'protect'
    });

    // Only allow public paths through without auth
    if (isPublic) {
        debugLog('✅ Allowing public access:', req.path);
        return next();
    }
    
    // Both API and protected routes need authentication
    debugLog('🔒 Enforcing auth:', req.path);
    authMiddleware(req, res, next);
}

// Export authentication functions and middleware
module.exports = {
    resetAttempts,
    isLockedOut,
    recordAttempt,
    verifyPin,
    authMiddleware,
    cleanupInterval,
    getLastAttemptTime,
    getAttemptCount,
    isPublicPath,
    protectRoute,
    publicPaths
}; 