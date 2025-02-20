/**
 * Authentication module
 * Handles PIN-based authentication, brute force protection, and session management
 */

const crypto = require('crypto');
const config = require('../config');

// Brute force protection
const loginAttempts = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

function getClientIP(req) {
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress || 
               req.connection.socket.remoteAddress;
    
    debugLog('IP Resolution:', {
        ip,
        forwarded: req.headers['x-forwarded-for'],
        realIP: req.headers['x-real-ip'],
        originalIP: req.connection.remoteAddress
    });
    
    return ip;
}

function resetAttempts(ip) {
    debugLog('Resetting Attempts:', {
        ip,
        previousAttempts: loginAttempts.get(ip),
        allAttempts: Array.from(loginAttempts.entries())
    });
    loginAttempts.delete(ip);
}

function getLastAttemptTime(ip) {
    const attempts = loginAttempts.get(ip);
    return attempts ? attempts.lastAttempt : 0;
}

function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    const isLocked = attempts.count >= MAX_ATTEMPTS && 
                     Date.now() - attempts.lastAttempt < LOCKOUT_TIME;
    
    debugLog('Lockout Check:', {
        ip,
        attempts: attempts.count,
        lastAttempt: new Date(attempts.lastAttempt).toISOString(),
        timeSinceLastAttempt: Date.now() - attempts.lastAttempt,
        isLocked,
        currentLoginAttempts: Array.from(loginAttempts.entries())
    });
    
    return isLocked;
}

function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
    
    debugLog('Recording Attempt:', {
        ip,
        attempts: attempts.count,
        timestamp: new Date(attempts.lastAttempt).toISOString(),
        allAttempts: Array.from(loginAttempts.entries())
    });
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

function getRemainingLockoutTime(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return 0;
    
    const timeElapsed = Date.now() - attempts.lastAttempt;
    const remaining = Math.max(0, LOCKOUT_TIME - timeElapsed);
    
    debugLog('Remaining Lockout Time:', {
        ip,
        timeElapsed,
        remaining,
        lockoutTime: LOCKOUT_TIME,
        lastAttempt: new Date(attempts.lastAttempt).toISOString()
    });
    
    return remaining;
}

function getAttemptCount(ip) {
    const attempts = loginAttempts.get(ip);
    return attempts ? attempts.count : 0;
}

// Authentication middleware
const authMiddleware = (req, res, next) => {
    debugLog('Auth check for path:', req.path, 'Method:', req.method);
    
    // If no PIN is set, bypass authentication
    if (!config.PIN || config.PIN.trim() === '') {
        debugLog('Auth bypassed - No PIN configured');
        return next();
    }

    // Check if user is authenticated via session
    if (!req.session.authenticated) {
        debugLog('Auth failed - No valid session');
        // Only redirect HTML requests, return 401 for API requests
        if (req.accepts('html')) {
            return res.redirect(config.BASE_PATH + '/login');
        } else {
            return res.status(401).json({ error: 'Authentication required' });
        }
    }
    debugLog('Auth successful - Valid session found');
    next();
};

// Lockout middleware
const lockoutMiddleware = (req, res, next) => {
    const ip = getClientIP(req);
    
    if (isLockedOut(ip)) {
        const remainingTime = getRemainingLockoutTime(ip);
        const minutes = Math.ceil(remainingTime / 1000 / 60);
        
        debugLog('Lockout active:', {
            ip,
            remainingTime,
            minutes,
            attempts: getAttemptCount(ip),
            lastAttempt: new Date(getLastAttemptTime(ip)).toISOString()
        });
        
        return res.status(429).json({
            error: `Too many attempts. Please try again in ${minutes} minutes.`,
            remainingTime,
            lockoutEnds: new Date(Date.now() + remainingTime).toISOString(),
            attemptsCount: getAttemptCount(ip),
            maxAttempts: MAX_ATTEMPTS
        });
    }
    
    next();
};

// PIN verification middleware
const pinVerificationMiddleware = (req, res, next) => {
    const ip = getClientIP(req);
    
    // Check for lockout first
    if (isLockedOut(ip)) {
        const remainingTime = getRemainingLockoutTime(ip);
        const minutes = Math.ceil(remainingTime / 1000 / 60);
        return res.status(429).json({
            error: `Too many attempts. Please try again in ${minutes} minutes.`,
            remainingTime,
            lockoutEnds: new Date(Date.now() + remainingTime).toISOString(),
            attemptsCount: getAttemptCount(ip),
            maxAttempts: MAX_ATTEMPTS
        });
    }
    
    next();
};

// Start cleanup interval for old lockouts
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
            loginAttempts.delete(ip);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        debugLog(`Cleaned up ${cleanedCount} expired lockouts`);
    }
}, 60000); // Clean up every minute

// Export authentication functions and middleware
module.exports = {
    resetAttempts,
    isLockedOut,
    recordAttempt,
    verifyPin,
    authMiddleware,
    lockoutMiddleware,
    pinVerificationMiddleware,
    cleanupInterval,
    getClientIP,
    getRemainingLockoutTime,
    getAttemptCount,
    getLastAttemptTime,
    MAX_ATTEMPTS,
    LOCKOUT_TIME
}; 