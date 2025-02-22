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

// After session middleware but BEFORE any routes or static files
app.use((req, res, next) => {
    debugLog('🎯 Initial Request:', {
        url: req.url,
        path: req.path,
        method: req.method,
        stage: 'start',
        authenticated: !!req.session?.authenticated,
        stack: new Error().stack.split('\n').slice(1,3).join('\n') // Show call stack
    });
    next();
});

// First: Mount auth routes
debugLog('Mounting auth routes');
app.use(BASE_PATH, authRoutes);

// Second: Protection middleware
app.use(BASE_PATH, (req, res, next) => {
    debugLog('🛡️ Protection Layer:', {
        path: req.path,
        method: req.method,
        isPublic: auth.isPublicPath(req.path),
        isApi: req.path.startsWith('/api/'),
        authenticated: !!req.session?.authenticated,
        stack: new Error().stack.split('\n').slice(1,3).join('\n')
    });
    auth.protectRoute(req, res, next);
});

// Third: Static files (only after protection)
app.use(BASE_PATH, express.static(config.PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
        debugLog('📂 Serving Static:', {
            file: path.basename(filePath),
            type: path.extname(filePath)
        });
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
app.get(BASE_PATH + '/index.html', auth.authMiddleware, async (req, res, next) => {
    try {
        let html = await fsPromises.readFile(path.join(config.PUBLIC_DIR, 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

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