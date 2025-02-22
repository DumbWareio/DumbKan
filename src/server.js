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

// Security middleware
debugLog('Configuring Helmet middleware');
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

// Add request logging first
app.use((req, res, next) => {
    debugLog('Request received:', {
        url: req.url,
        path: req.path,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        method: req.method,
        headers: {
            accept: req.headers.accept,
            'content-type': req.headers['content-type']
        }
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

// Serve static files for public assets FIRST
debugLog('Mounting static file middleware');
app.use(BASE_PATH, express.static(config.PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
        debugLog('Static file request:', {
            filePath,
            resolvedPath: path.resolve(filePath),
            requestedFile: path.basename(filePath),
            contentType: path.extname(filePath)
        });
        
        // Set appropriate content types without nosniff
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
            // Explicitly remove nosniff for HTML
            res.removeHeader('X-Content-Type-Options');
        }
    }
}));

// Mount auth routes AFTER static files
debugLog('Mounting auth routes');
app.use(BASE_PATH, authRoutes);

// Add auth middleware for protected routes
app.use(BASE_PATH, (req, res, next) => {
    const publicPaths = [
        '/login',
        '/login.html',
        '/pin-length',
        '/verify-pin',
        '/styles.css',
        '/config.js',
        '/script.js',
        '/dumbdateparser.js',  // Add dumbdateparser.js to public paths
        '/manifest.json',
        '/favicon.svg',
        '/logo.png',
        '/marked.min.js'
    ];
    
    // Check if the path is public or starts with /api/
    if (publicPaths.some(path => req.path.endsWith(path)) || req.path.startsWith('/api/')) {
        return next();
    }
    
    auth.authMiddleware(req, res, next);
});

// Serve config.js for frontend - this needs to be accessible without auth
app.get(BASE_PATH + '/config.js', (req, res) => {
    debugLog('Serving config.js:', {
        basePath: BASE_PATH,
        protocol: req.protocol,
        hostname: req.hostname
    });
    
    const fullUrl = `${req.protocol}://${req.headers.host}${BASE_PATH}`;
    debugLog('Constructed full URL:', fullUrl);

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

        // Set the site title
        document.title = window.appConfig.siteTitle;

        // Also update any elements with the site title placeholder
        document.querySelectorAll('.app-title').forEach(element => {
            element.textContent = window.appConfig.siteTitle;
        });
    `);
});

// Routes
app.get(BASE_PATH + '/', auth.authMiddleware, async (req, res, next) => {
    try {
        let html = await fsPromises.readFile(path.join(config.PUBLIC_DIR, 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

app.get(BASE_PATH + '/index.html', auth.authMiddleware, async (req, res, next) => {
    try {
        let html = await fsPromises.readFile(path.join(config.PUBLIC_DIR, 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

app.get(BASE_PATH + '/login', (req, res) => {
    debugLog('Login route handler:', {
        requestPath: req.path,
        resolvedFile: path.resolve(path.join(config.PUBLIC_DIR, 'login.html')),
        acceptHeader: req.headers.accept
    });

    // If no PIN is set, redirect to index
    if (!PIN || PIN.trim() === '') {
        debugLog('No PIN set, redirecting to:', BASE_PATH + '/');
        return res.redirect(BASE_PATH + '/');
    }

    if (req.session.authenticated) {
        debugLog('Already authenticated, redirecting to:', BASE_PATH + '/');
        return res.redirect(BASE_PATH + '/');
    }

    // Redirect /login to /login.html to ensure consistent handling
    if (!req.path.endsWith('.html')) {
        debugLog('Redirecting to /login.html for consistent handling');
        return res.redirect(BASE_PATH + '/login.html');
    }

    debugLog('Serving login.html from:', path.join(config.PUBLIC_DIR, 'login.html'));
    res.type('text/html');
    res.sendFile(path.join(config.PUBLIC_DIR, 'login.html'), (err) => {
        if (err) {
            debugLog('Error serving login.html:', err);
            res.status(500).send('Error loading login page');
        }
    });
});

app.get(BASE_PATH + '/pin-length', (req, res) => {
    // If no PIN is set, return 0 length
    if (!PIN || PIN.trim() === '') {
        return res.json({ length: 0 });
    }
    res.json({ length: PIN.length });
});

app.post(BASE_PATH + '/verify-pin', (req, res) => {
    debugLog('PIN verification attempt from IP:', req.ip);
    
    // If no PIN is set, authentication is successful
    if (!PIN || PIN.trim() === '') {
        debugLog('PIN verification bypassed - No PIN configured');
        req.session.authenticated = true;
        return res.status(200).json({ success: true });
    }

    const ip = req.ip;
    
    // Check if IP is locked out
    if (isLockedOut(ip)) {
        const attempts = loginAttempts.get(ip);
        const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
        debugLog('PIN verification blocked - IP is locked out:', ip);
        return res.status(429).json({ 
            error: `Too many attempts. Please try again in ${timeLeft} minutes.`
        });
    }

    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
        debugLog('PIN verification failed - Invalid PIN format');
        return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Add artificial delay to further prevent timing attacks
    const delay = crypto.randomInt(50, 150);
    setTimeout(() => {
        if (verifyPin(PIN, pin)) {
            debugLog('PIN verification successful');
            // Reset attempts on successful login
            resetAttempts(ip);
            
            // Set authentication in session
            req.session.authenticated = true;
            
            // Set secure cookie
            res.cookie(`${projectName}_PIN`, pin, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.status(200).json({ success: true });
        } else {
            debugLog('PIN verification failed - Invalid PIN');
            // Record failed attempt
            recordAttempt(ip);
            
            const attempts = loginAttempts.get(ip);
            const attemptsLeft = MAX_ATTEMPTS - attempts.count;
            
            res.status(401).json({ 
                error: 'Invalid PIN',
                attemptsLeft: Math.max(0, attemptsLeft)
            });
        }
    }, delay);
});

// Cleanup old lockouts periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
            loginAttempts.delete(ip);
        }
    }
}, 60000); // Clean up every minute

// Helper function to ensure data directory exists
async function ensureDataDirectory() {
    const dir = path.dirname(config.DATA_FILE);
    try {
        await fsPromises.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

// Helper function to read data
async function readData() {
    await ensureDataDirectory();
    try {
        const data = await fsPromises.readFile(config.DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create default data structure if file doesn't exist
            const boardId = generateBoardId();
            const todoId = generateSectionId();
            const doingId = generateSectionId();
            const doneId = generateSectionId();
            
            const defaultData = {
                boards: {
                    [boardId]: {
                        id: boardId,
                        name: "Personal",
                        sectionOrder: [todoId, doingId, doneId]
                    }
                },
                sections: {
                    [todoId]: {
                        id: todoId,
                        name: "To Do",
                        boardId: boardId,
                        taskIds: []
                    },
                    [doingId]: {
                        id: doingId,
                        name: "Doing",
                        boardId: boardId,
                        taskIds: []
                    },
                    [doneId]: {
                        id: doneId,
                        name: "Done",
                        boardId: boardId,
                        taskIds: []
                    }
                },
                tasks: {},
                activeBoard: boardId
            };

            // Write the default data to file
            await writeData(defaultData);
            return defaultData;
        }
        throw error;
    }
}

// Helper function to write data
async function writeData(data) {
    await ensureDataDirectory();
    await fsPromises.writeFile(config.DATA_FILE, JSON.stringify(data, null, 2));
}

// Simple ID generator
function generateId() {
    return Math.random().toString(36).slice(2, 11); // 9 chars
}

// Helper functions all use the same simple ID generator
function generateTaskId() {
    return generateId();
}

function generateSectionId() {
    return generateId();
}

function generateBoardId() {
    return generateId();
}

function generateUniqueSectionId() {
    return generateId();
}

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

// Create new board
app.post(BASE_PATH + '/api/boards', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Board name is required' });
        }

        const data = await readData();
        const boardId = generateBoardId();
        
        // Create default sections with unique IDs
        const defaultSections = [
            { name: 'To Do' },
            { name: 'Doing' },
            { name: 'Done' }
        ];

        const sectionOrder = [];
        
        // Create unique sections for this board
        defaultSections.forEach(section => {
            const sectionId = generateUniqueSectionId();
            sectionOrder.push(sectionId);
            
            data.sections[sectionId] = {
                id: sectionId,
                name: section.name,
                boardId: boardId,
                taskIds: []
            };
        });

        // Create board with the unique section order
        data.boards[boardId] = {
            id: boardId,
            name,
            sectionOrder
        };

        await writeData(data);
        res.json({ id: boardId, ...data.boards[boardId] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create board' });
    }
});

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

// Add section to board
app.post(BASE_PATH + '/api/boards/:boardId/sections', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Section name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        const sectionId = generateUniqueSectionId();
        
        // Create new section
        data.sections[sectionId] = {
            id: sectionId,
            name,
            boardId,
            taskIds: []
        };

        // Add section to board's section order
        data.boards[boardId].sectionOrder.push(sectionId);

        await writeData(data);
        res.json(data.sections[sectionId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create section' });
    }
});

// Add task to section
app.post(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/tasks', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { title, description, priority = 'medium', dueDate = null, startDate = null } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        // Validate priority
        const validPriorities = ['urgent', 'high', 'medium', 'low'];
        const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

        const data = await readData();
        if (!data.sections[sectionId] || data.sections[sectionId].boardId !== boardId) {
            return res.status(404).json({ error: 'Board or section not found' });
        }

        const taskId = generateTaskId();
        const now = new Date().toISOString();

        // Create new task with validated priority and optional dates
        const task = {
            id: taskId,
            title,
            description: description || '',
            createdAt: now,
            updatedAt: now,
            sectionId,
            boardId,
            priority: taskPriority,
            status: 'active',
            tags: [],
            assignee: null,
            dueDate,
            startDate
        };

        // Add task to tasks collection
        data.tasks[taskId] = task;

        // Add task ID to section
        data.sections[sectionId].taskIds.push(taskId);

        await writeData(data);
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Move task between sections
app.post(BASE_PATH + '/api/boards/:boardId/tasks/:taskId/move', async (req, res) => {
    try {
        const { boardId, taskId } = req.params;
        const { fromSectionId, toSectionId, newIndex } = req.body;

        const data = await readData();
        
        // Validate board and sections exist
        if (!data.sections[fromSectionId] || !data.sections[toSectionId]) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove task from source section
        const fromTaskIds = data.sections[fromSectionId].taskIds;
        const taskIndex = fromTaskIds.indexOf(taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }
        fromTaskIds.splice(taskIndex, 1);

        // Add task to target section
        const toTaskIds = data.sections[toSectionId].taskIds;
        if (typeof newIndex === 'number') {
            toTaskIds.splice(newIndex, 0, taskId);
        } else {
            toTaskIds.push(taskId);
        }

        // Update task's section reference
        data.tasks[taskId].sectionId = toSectionId;
        data.tasks[taskId].updatedAt = new Date().toISOString();

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move task' });
    }
});

// Update task
app.put(BASE_PATH + '/api/boards/:boardId/sections/:sectionId/tasks/:taskId', async (req, res) => {
    try {
        const { boardId, sectionId, taskId } = req.params;
        const updates = req.body;

        const data = await readData();
        const task = data.tasks[taskId];

        if (!task || task.sectionId !== sectionId || task.boardId !== boardId) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update task properties
        Object.assign(task, {
            ...updates,
            updatedAt: new Date().toISOString()
        });

        await writeData(data);
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

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