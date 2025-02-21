/**
 * Authentication routes
 * Handles login, PIN verification, and related endpoints
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const auth = require('../middleware/auth');

const router = express.Router();

// Login page route
router.get('/login', (req, res) => {
    // If no PIN is set, redirect to index
    if (!config.PIN || config.PIN.trim() === '') {
        return res.redirect(config.BASE_PATH + '/');
    }

    if (req.session.authenticated) {
        return res.redirect(config.BASE_PATH + '/');
    }
    res.sendFile(path.join(config.PUBLIC_DIR, 'login.html'));
});

// PIN length endpoint
router.get('/pin-length', (req, res) => {
    // If no PIN is set, return 0 length
    if (!config.PIN || config.PIN.trim() === '') {
        return res.json({ length: 0 });
    }
    res.json({ length: config.PIN.length });
});

// PIN verification endpoint
router.post('/verify-pin', (req, res) => {
    if (config.DEBUG) console.log('[DEBUG] PIN verification attempt from IP:', req.ip);
    
    // If no PIN is set, authentication is successful
    if (!config.PIN || config.PIN.trim() === '') {
        if (config.DEBUG) console.log('[DEBUG] PIN verification bypassed - No PIN configured');
        req.session.authenticated = true;
        return res.status(200).json({ success: true });
    }

    const ip = req.ip;
    
    // Check if IP is locked out
    if (auth.isLockedOut(ip)) {
        const timeLeft = Math.ceil((config.LOCKOUT_TIME - (Date.now() - auth.getLastAttemptTime(ip))) / 1000 / 60);
        if (config.DEBUG) console.log('[DEBUG] PIN verification blocked - IP is locked out:', ip);
        return res.status(429).json({ 
            error: `Too many attempts. Please try again in ${timeLeft} minutes.`
        });
    }

    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
        if (config.DEBUG) console.log('[DEBUG] PIN verification failed - Invalid PIN format');
        return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Add artificial delay to further prevent timing attacks
    const delay = crypto.randomInt(50, 150);
    setTimeout(() => {
        if (auth.verifyPin(config.PIN, pin)) {
            if (config.DEBUG) console.log('[DEBUG] PIN verification successful');
            // Reset attempts on successful login
            auth.resetAttempts(ip);
            
            // Set authentication in session
            req.session.authenticated = true;
            
            // Set secure cookie
            res.cookie(`${config.projectName}_PIN`, pin, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.status(200).json({ success: true });
        } else {
            if (config.DEBUG) console.log('[DEBUG] PIN verification failed - Invalid PIN');
            // Record failed attempt
            auth.recordAttempt(ip);
            
            const attemptsLeft = config.MAX_ATTEMPTS - auth.getAttemptCount(ip);
            
            res.status(401).json({ 
                error: 'Invalid PIN',
                attemptsLeft: Math.max(0, attemptsLeft)
            });
        }
    }, delay);
});

module.exports = router; 