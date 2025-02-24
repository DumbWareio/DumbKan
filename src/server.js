require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const fsPromises = fs.promises;

// Import configuration and middleware
const config = require('./config');
const auth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const BASE_PATH = require('./config/base-path');

// Import data operations
const { readData, writeData } = require('./utils/data-operations');

// Import route handlers
const boardRoutes = require('./routes/board-routes');
const sectionRoutes = require('./routes/section-routes');
const taskRoutes = require('./routes/task-routes');
const taskStandaloneRoutes = require('./routes/task-standalone-routes');

const app = express();

// Get site title from environment variable or use default
const siteTitle = config.SITE_TITLE || 'DumbKan';

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Log configuration
debugLog('Starting server with config:', {
    PIN: config.PIN ? 'SET' : 'NOT SET',
    BASE_PATH: config.BASE_PATH,
    NODE_ENV: config.NODE_ENV,
    DEBUG: config.DEBUG
});

// Near the start of the file, after config import
debugLog('PIN Configuration:', {
    PIN_SET: !!config.PIN,
    PIN_LENGTH: config.PIN ? config.PIN.length : 0,
    PIN_VALUE: config.PIN ? '****' : 'NOT SET'
});

// BASE_PATH configuration has been moved to ./config/base-path.js
// The logic for BASE_PATH initialization and normalization now lives there

// Get the project name from package.json to use for the PIN environment variable
const projectName = config.projectName;
const PIN = config.PIN;

// Log whether PIN protection is enabled
if (!PIN || PIN.trim() === '') {
    debugLog('PIN protection is disabled');
} else {
    debugLog('PIN protection is enabled, PIN length:', PIN.length);
}

// First, security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'"],
            workerSrc: ["'self'", "'unsafe-eval'"],
            manifestSrc: ["'self'"]
        },
    },
    // Disable HSTS in development
    hsts: false,
    // Explicitly allow same-origin for all resources
    crossOriginResourcePolicy: { policy: 'same-origin' }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration with secure settings
const sessionConfig = {
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

debugLog('Configuring session middleware:', {
    nodeEnv: config.NODE_ENV,
    secureCookie: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite
});

app.use(session(sessionConfig));

// Serve static files BEFORE auth middleware
app.use(BASE_PATH, express.static(config.PUBLIC_DIR, {
    index: false, // Disable directory indexing
    setHeaders: (res, filePath) => {
        if (config.DEBUG) {
            debugLog('📂 Static File Request:', {
                originalUrl: req.originalUrl,
                baseUrl: req.baseUrl,
                path: req.path,
                publicDir: config.PUBLIC_DIR,
                resolvedPath: filePath,
                basePath: BASE_PATH,
                exists: fs.existsSync(filePath)
            });
        }
        // Set proper cache headers
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

// Add a diagnostic middleware to log all requests
app.use((req, res, next) => {
    debugLog('🔍 Request Diagnostic:', {
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        hostname: req.hostname,
        protocol: req.protocol,
        headers: {
            host: req.headers.host,
            'x-forwarded-prefix': req.headers['x-forwarded-prefix'],
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'x-forwarded-host': req.headers['x-forwarded-host']
        }
    });
    next();
});

// Auth routes
app.use(BASE_PATH, authRoutes);

// Protection middleware - everything after this requires authentication
app.use(BASE_PATH, auth.protectRoute);

// Protected routes and API endpoints
// Second: Special route handlers (before protection)
app.get(BASE_PATH + '/config.js', (req, res) => {
    debugLog('Serving config.js');
    res.type('application/javascript').send(`
        window.appConfig = {
            basePath: '${BASE_PATH}',
            debug: ${config.DEBUG},
            siteTitle: '${siteTitle}',
            version: '1.0.0',
            apiUrl: '${req.protocol}://${req.headers.host}${BASE_PATH}'
        };

        // Log configuration to help debug
        if (${config.DEBUG}) {
            console.log('App config loaded:', window.appConfig);
        }

        // Wait for DOM to be ready
        document.addEventListener('DOMContentLoaded', () => {
            // Set the site title
            document.title = window.appConfig.siteTitle;

            // Update any elements with the site title placeholder
            document.querySelectorAll('.app-title, h1').forEach(element => {
                if (element.textContent.includes('{{SITE_TITLE}}')) {
                    element.textContent = window.appConfig.siteTitle;
                }
            });
        });
    `);
});

// Request logging
app.use((req, res, next) => {
    debugLog('🔍 Request Pipeline Start:', {
        url: req.url,
        path: req.path,
        session: {
            exists: !!req.session,
            authenticated: req.session?.authenticated
        },
        headers: {
            'service-worker': req.headers['service-worker'],
            'cache-control': req.headers['cache-control']
        }
    });
    next();
});

// Add this before the auth middleware
app.use(BASE_PATH, (req, res, next) => {
    debugLog('Request path check:', {
        path: req.path,
        method: req.method,
        authenticated: !!req.session.authenticated
    });
    next();
});

// Serve dumbdateparser.js from node_modules BEFORE auth middleware
app.get(BASE_PATH + '/dumbdateparser.js', (req, res) => {
    const filePath = path.join(__dirname, '../node_modules/dumbdateparser/src/browser.js');
    console.log('[DEBUG] Serving dumbdateparser.js');
    console.log('[DEBUG] File path:', filePath);
    console.log('[DEBUG] Base path:', BASE_PATH);
    console.log('[DEBUG] Full URL:', req.url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('[ERROR] dumbdateparser.js not found at:', filePath);
        return res.status(404).send('File not found');
    }
    
    // Set correct MIME type and cache headers
    res.set({
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
    });
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('[ERROR] Error serving dumbdateparser.js:', err);
            if (!res.headersSent) {
                res.status(500).send('Error serving file');
            }
        } else {
            console.log('[DEBUG] Successfully served dumbdateparser.js');
        }
    });
});

// Root route can now be simpler
app.get(BASE_PATH + '/', auth.authMiddleware, async (req, res, next) => {
    try {
        let html = await fsPromises.readFile(path.join(config.PUBLIC_DIR, 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

// Routes
app.get(BASE_PATH + '/index.html', auth.authMiddleware, async (req, res, next) => {
    try {
        let html = await fsPromises.readFile(path.join(config.PUBLIC_DIR, 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

// API Routes
// Board routes have been moved to src/routes/board-routes.js
// app.get(BASE_PATH + '/api/boards', ...)
// app.post(BASE_PATH + '/api/boards/active', ...)
// app.put(BASE_PATH + '/api/boards/:boardId', ...)
// app.delete(BASE_PATH + '/api/boards/:boardId', ...)

// Mount board routes
app.use(BASE_PATH + '/api/boards', boardRoutes);

// Mount section routes
app.use(BASE_PATH + '/api/boards/:boardId/sections', sectionRoutes);

// Mount task routes (standalone routes first, then task creation route)
app.use(BASE_PATH + '/api/tasks', taskStandaloneRoutes);
app.use(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/tasks', taskRoutes);

// Move section within board route has been moved to src/routes/section-routes.js
// app.post(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/move', ...)

// Add update board endpoint
app.put(BASE_PATH + '/api/boards/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Board name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Update board name
        data.boards[boardId].name = name;
        await writeData(data);
        res.json(data.boards[boardId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update board' });
    }
});

// Update section route has been moved to src/routes/section-routes.js
// app.put(BASE_PATH + '/api/boards/:boardId/sections/:sectionId', ...)

// Delete section route has been moved to src/routes/section-routes.js
// app.delete(BASE_PATH + '/api/boards/:boardId/sections/:sectionId', ...)

// Add delete board endpoint
// Board delete route has been moved to src/routes/board-routes.js
// app.delete(BASE_PATH + '/api/boards/:boardId', ...)

// Export the app instead of starting it here
module.exports = app; 