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
    const ip = auth.getClientIP(req);
    
    // If no PIN is set, return 0 length
    if (!config.PIN || config.PIN.trim() === '') {
        return res.json({ length: 0 });
    }

    // If IP is locked out, include lockout info
    if (auth.isLockedOut(ip)) {
        const remainingTime = auth.getRemainingLockoutTime(ip);
        const minutes = Math.ceil(remainingTime / 1000 / 60);
        return res.json({ 
            length: config.PIN.length,
            locked: true,
            error: `Too many attempts. Please try again in ${minutes} minutes.`,
            remainingTime,
            lockoutEnds: new Date(Date.now() + remainingTime).toISOString(),
            attemptsCount: auth.getAttemptCount(ip),
            maxAttempts: auth.MAX_ATTEMPTS
        });
    }

    // Return PIN length with attempt info
    res.json({ 
        length: config.PIN.length,
        locked: false,
        attemptsCount: auth.getAttemptCount(ip),
        maxAttempts: auth.MAX_ATTEMPTS
    });
});

// PIN verification endpoint
router.post('/verify-pin', auth.pinVerificationMiddleware, (req, res) => {
    const ip = auth.getClientIP(req);
    
    // If no PIN is set, authentication is successful
    if (!config.PIN || config.PIN.trim() === '') {
        req.session.authenticated = true;
        return res.status(200).json({ success: true });
    }

    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Add artificial delay to further prevent timing attacks
    const delay = crypto.randomInt(50, 150);
    setTimeout(() => {
        try {
            if (auth.verifyPin(config.PIN, pin)) {
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
                // Record failed attempt
                auth.recordAttempt(ip);
                
                const attemptsLeft = auth.MAX_ATTEMPTS - auth.getAttemptCount(ip);
                
                // Check if this attempt caused a lockout
                if (auth.isLockedOut(ip)) {
                    const remainingTime = auth.getRemainingLockoutTime(ip);
                    const minutes = Math.ceil(remainingTime / 1000 / 60);
                    return res.status(429).json({
                        error: `Too many attempts. Please try again in ${minutes} minutes.`,
                        remainingTime,
                        lockoutEnds: new Date(Date.now() + remainingTime).toISOString(),
                        attemptsCount: auth.getAttemptCount(ip),
                        maxAttempts: auth.MAX_ATTEMPTS
                    });
                }
                
                res.status(401).json({ 
                    error: 'Invalid PIN',
                    attemptsLeft: Math.max(0, attemptsLeft),
                    attemptsCount: auth.getAttemptCount(ip),
                    maxAttempts: auth.MAX_ATTEMPTS
                });
            }
        } catch (error) {
            // Record attempt even on error
            auth.recordAttempt(ip);
            res.status(500).json({ 
                error: 'An error occurred while verifying PIN',
                attemptsLeft: Math.max(0, auth.MAX_ATTEMPTS - auth.getAttemptCount(ip))
            });
        }
    }, delay);
});

module.exports = router; 