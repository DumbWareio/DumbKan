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
const BASE_PATH = require('./config/base-path'); // Import the BASE_PATH from its new location

// MOVED: readData, writeData, and ID generation functions to /src/utils/data-operations.js
const { 
    readData, 
    writeData, 
    generateTaskId, 
    generateSectionId, 
    generateBoardId, 
    generateUniqueSectionId 
} = require('./utils/data-operations');

// MOVED: Board creation route to /src/routes/board-routes.js
const boardRoutes = require('./routes/board-routes');

// MOVED: Section creation route to /src/routes/section-routes.js
const sectionRoutes = require('./routes/section-routes');

// MOVED: Task creation route to /src/routes/task-routes.js
const taskRoutes = require('./routes/task-routes');

const app = express();

// Get site title from environment variable or use default
const siteTitle = config.SITE_TITLE || 'DumbKan';

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Add at the start of the file after imports:
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
            workerSrc: ["'self'"],
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

// At the top with other middleware, before routes
app.use((req, res, next) => {
    debugLog('🔍 Request:', {
        url: req.url,
        path: req.path,
        method: req.method,
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

// First: Mount auth routes
debugLog('Mounting auth routes');
app.use(BASE_PATH, authRoutes);

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

// Third: Protection middleware
app.use(BASE_PATH, auth.protectRoute);

// Fourth: Static files (after protection)
app.use(BASE_PATH, express.static(config.PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
        debugLog('📂 Static:', path.basename(filePath));
    }
}));

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

// Get all data
app.get(BASE_PATH + '/api/boards', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load boards' });
    }
});

// MOVED: Board creation route to /src/routes/board-routes.js
app.use(BASE_PATH + '/api/boards', boardRoutes);

// Set active board
app.post(BASE_PATH + '/api/boards/active', async (req, res) => {
    try {
        const { boardId } = req.body;
        const data = await readData();
        
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        data.activeBoard = boardId;
        await writeData(data);
        res.json({ activeBoard: boardId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set active board' });
    }
});

// MOVED: Section creation route to /src/routes/section-routes.js
app.use(BASE_PATH + '/api/boards/:boardId/sections', sectionRoutes);

// MOVED: Task routes to /src/routes/task-routes.js
app.use(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/tasks', taskRoutes);

// Delete task
app.delete(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/tasks/:taskId', async (req, res) => {
    try {
        const { boardId, sectionId, taskId } = req.params;

        const data = await readData();
        
        // Remove task from section
        const section = data.sections[sectionId];
        if (!section || section.boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const taskIndex = section.taskIds.indexOf(taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Remove task ID from section
        section.taskIds.splice(taskIndex, 1);
        
        // Delete task from tasks collection
        delete data.tasks[taskId];

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// Move section within board
app.post(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/move', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { newIndex } = req.body;

        const data = await readData();
        const board = data.boards[boardId];
        
        if (!board) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Remove section from current position
        const currentIndex = board.sectionOrder.indexOf(sectionId);
        if (currentIndex === -1) {
            return res.status(404).json({ error: 'Section not found in board' });
        }
        board.sectionOrder.splice(currentIndex, 1);

        // Insert section at new position
        board.sectionOrder.splice(newIndex, 0, sectionId);

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move section' });
    }
});

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

// Add update section endpoint
app.put(BASE_PATH + '/api/boards/:boardId/sections/:sectionId', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Section name is required' });
        }

        const data = await readData();
        if (!data.sections[sectionId] || data.sections[sectionId].boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Update section name
        data.sections[sectionId].name = name;
        await writeData(data);
        res.json(data.sections[sectionId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update section' });
    }
});

// Add delete section endpoint
app.delete(BASE_PATH + '/api/boards/:boardId/sections/:sectionId', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const data = await readData();

        // Verify board and section exist
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        const section = data.sections[sectionId];
        if (!section || section.boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove section from board's sectionOrder
        const board = data.boards[boardId];
        const sectionIndex = board.sectionOrder.indexOf(sectionId);
        if (sectionIndex !== -1) {
            board.sectionOrder.splice(sectionIndex, 1);
        }

        // Delete all tasks in the section
        if (Array.isArray(section.taskIds)) {
            section.taskIds.forEach(taskId => {
                delete data.tasks[taskId];
            });
        }

        // Delete the section
        delete data.sections[sectionId];

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

// Add delete board endpoint
app.delete(BASE_PATH + '/api/boards/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const data = await readData();

        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Delete all sections and their tasks for this board
        Object.entries(data.sections).forEach(([sectionId, section]) => {
            if (section.boardId === boardId) {
                // Delete all tasks in the section
                if (Array.isArray(section.taskIds)) {
                    section.taskIds.forEach(taskId => {
                        delete data.tasks[taskId];
                    });
                }
                // Delete the section
                delete data.sections[sectionId];
            }
        });

        // Delete the board
        delete data.boards[boardId];

        // If this was the active board, switch to another board
        if (data.activeBoard === boardId) {
            const remainingBoards = Object.keys(data.boards);
            data.activeBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
        }

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete board' });
    }
});

// Export the app instead of starting it here
module.exports = app; 