require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DUMBKAN_DEBUG === 'true' || process.env.DEBUG === 'TRUE';

// Get site title from environment variable or use default
const siteTitle = process.env.SITE_TITLE || 'DumbKan';

function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Base URL configuration
const BASE_PATH = (() => {
    if (!process.env.BASE_URL) {
        debugLog('No BASE_URL set, using empty base path');
        return '';
    }

    // Clean and normalize the path
    let path = process.env.BASE_URL;

    // If it's a full URL, extract just the path portion
    try {
        const url = new URL(path);
        path = url.pathname;
    } catch {
        // Not a full URL, treat as a path
        // No action needed as we'll process it as a path
    }

    // Ensure path starts with / if not empty
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }

    // Remove trailing slash if present
    path = path.replace(/\/$/, '');

    debugLog('Base URL Configuration:', {
        originalUrl: process.env.BASE_URL,
        normalizedPath: path
    });

    return path;
})();

// Get the project name from package.json to use for the PIN environment variable
const projectName = require('./package.json').name.toUpperCase().replace(/-/g, '_');
const PIN = process.env[`${projectName}_PIN`];

// Log whether PIN protection is enabled
if (!PIN || PIN.trim() === '') {
    debugLog('PIN protection is disabled');
} else {
    debugLog('PIN protection is enabled, PIN length:', PIN.length);
}

// Brute force protection
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

function resetAttempts(ip) {
    debugLog('Resetting login attempts for IP:', ip);
    loginAttempts.delete(ip);
}

function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= MAX_ATTEMPTS) {
        const timeElapsed = Date.now() - attempts.lastAttempt;
        if (timeElapsed < LOCKOUT_TIME) {
            debugLog('IP is locked out:', ip, 'Time remaining:', Math.ceil((LOCKOUT_TIME - timeElapsed) / 1000 / 60), 'minutes');
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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"]
        },
    },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration with secure settings
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
    debugLog('Auth check for path:', req.path, 'Method:', req.method);
    
    // If no PIN is set, bypass authentication
    if (!PIN || PIN.trim() === '') {
        debugLog('Auth bypassed - No PIN configured');
        return next();
    }

    // Check if user is authenticated via session
    if (!req.session.authenticated) {
        debugLog('Auth failed - No valid session, redirecting to login');
        return res.redirect(BASE_PATH + '/login');
    }
    debugLog('Auth successful - Valid session found');
    next();
};

// Serve config.js for frontend
app.get(BASE_PATH + '/config.js', (req, res) => {
    debugLog('Serving config.js with basePath:', BASE_PATH);
    res.type('application/javascript').send(`
        window.appConfig = {
            basePath: '${BASE_PATH}',
            debug: ${DEBUG},
            siteTitle: '${siteTitle}',
            version: '1.0.0'
        };

        // Set the site title
        document.title = window.appConfig.siteTitle;

        // Also update any elements with the site title placeholder
        document.querySelectorAll('.app-title').forEach(element => {
            element.textContent = window.appConfig.siteTitle;
        });
    `);
});

// Serve static files for public assets
app.use(BASE_PATH + '/styles.css', express.static('public/styles.css'));
app.use(BASE_PATH + '/script.js', express.static('public/script.js'));
app.use(BASE_PATH + '/manifest.json', express.static('public/manifest.json'));
app.use(BASE_PATH + '/sw.js', express.static('public/sw.js'));
app.use(BASE_PATH + '/icons', express.static('public/icons'));
app.use(BASE_PATH + '/logo.png', express.static('public/logo.png'));
app.use(BASE_PATH + '/favicon.svg', express.static('public/favicon.svg'));
app.use(BASE_PATH + '/marked.min.js', express.static('public/marked.min.js'));

// Serve dumbdateparser.js with explicit MIME type
app.get(BASE_PATH + '/dumbdateparser.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'dumbdateparser.js'));
});

// Add this near the top with other middleware
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Routes
app.get(BASE_PATH + '/', authMiddleware, async (req, res, next) => {
    try {
        let html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

app.get(BASE_PATH + '/index.html', authMiddleware, async (req, res, next) => {
    try {
        let html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
        html = html.replace(/{{SITE_TITLE}}/g, siteTitle);
        res.send(html);
    } catch (error) {
        next(error);
    }
});

app.get(BASE_PATH + '/login', (req, res) => {
    // If no PIN is set, redirect to index
    if (!PIN || PIN.trim() === '') {
        return res.redirect(BASE_PATH + '/');
    }

    if (req.session.authenticated) {
        return res.redirect(BASE_PATH + '/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
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

// Data file path
const DATA_FILE = path.join(__dirname, 'dumbdata', 'tasks.json');

// Helper function to ensure data directory exists
async function ensureDataDirectory() {
    const dir = path.dirname(DATA_FILE);
    try {
        await fs.mkdir(dir, { recursive: true });
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
        const data = await fs.readFile(DATA_FILE, 'utf8');
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
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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

app.listen(PORT, () => {
    debugLog('Server Configuration:', {
        port: PORT,
        basePath: BASE_PATH,
        pinProtection: !!PIN,
        nodeEnv: process.env.NODE_ENV || 'development',
        debug: DEBUG
    });
    console.log(`Server running on port ${PORT}`);
    console.log(`Site title set to: ${siteTitle}`);
}); 