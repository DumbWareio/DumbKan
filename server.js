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
const DEBUG = process.env.DEBUG === 'TRUE';

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
    try {
        const url = new URL(process.env.BASE_URL);
        const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash
        debugLog('Base URL Configuration:', {
            originalUrl: process.env.BASE_URL,
            extractedPath: path,
            protocol: url.protocol,
            hostname: url.hostname
        });
        return path;
    } catch {
        // If BASE_URL is just a path (e.g. /app)
        const path = process.env.BASE_URL.replace(/\/$/, '');
        debugLog('Using direct path as BASE_URL:', path);
        return path;
    }
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
            scriptSrc: ["'self'", "'sha256-9QQdPjcXJPuOrPrQUD2Ni0Iisj7itcA+jSSYpXJwzTw='"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'"],
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
            title: '${siteTitle}'
        };
    `);
});

// Serve static files for public assets
app.use(BASE_PATH + '/styles.css', express.static('public/styles.css'));
app.use(BASE_PATH + '/script.js', express.static('public/script.js'));

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
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');

// Helper function to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Return default data structure if file doesn't exist
            return {
                boards: {
                    personal: {
                        name: 'Personal',
                        columns: {
                            todo: {
                                name: 'To Do',
                                tasks: []
                            },
                            doing: {
                                name: 'Doing',
                                tasks: []
                            },
                            done: {
                                name: 'Done',
                                tasks: []
                            }
                        }
                    }
                },
                activeBoard: 'personal'
            };
        }
        throw error;
    }
}

// Helper function to write data
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper function to generate column ID
function generateColumnId(name) {
    // Convert name to lowercase and remove special characters
    const simpleName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // If it's one of the default column names, use the simple format
    if (['todo', 'doing', 'done'].includes(simpleName)) {
        return simpleName;
    }
    
    // Otherwise, use the timestamp format
    return `column-${Date.now()}`;
}

// Helper function to generate board ID
function generateBoardId(name) {
    // Convert name to lowercase and remove special characters
    const simpleName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // If it's one of the default board names, use the simple format
    if (['personal', 'work'].includes(simpleName)) {
        return simpleName;
    }
    
    // Otherwise, use the timestamp format
    return `board-${Date.now()}`;
}

// API Routes

// Get all boards
app.get('/api/boards', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load boards' });
    }
});

// Create new board
app.post('/api/boards', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Board name is required' });
        }

        const data = await readData();
        const id = generateBoardId(name);
        
        data.boards[id] = {
            name,
            columns: {
                todo: {
                    name: 'To Do',
                    tasks: []
                },
                doing: {
                    name: 'Doing',
                    tasks: []
                },
                done: {
                    name: 'Done',
                    tasks: []
                }
            }
        };

        await writeData(data);
        res.json({ id, ...data.boards[id] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create board' });
    }
});

// Set active board
app.post('/api/boards/active', async (req, res) => {
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

// Add column to board
app.post('/api/boards/:boardId/columns', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Column name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        const columnId = generateColumnId(name);
        data.boards[boardId].columns[columnId] = {
            name,
            tasks: []
        };

        await writeData(data);
        res.json({ id: columnId, name, tasks: [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create column' });
    }
});

// Add task to column
app.post('/api/boards/:boardId/columns/:columnId/tasks', async (req, res) => {
    try {
        const { boardId, columnId } = req.params;
        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]?.columns[columnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        const task = {
            id: `task-${Date.now()}`,
            title,
            description: description || ''
        };

        data.boards[boardId].columns[columnId].tasks.push(task);
        await writeData(data);
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Move task between columns
app.post('/api/boards/:boardId/tasks/:taskId/move', async (req, res) => {
    try {
        const { boardId, taskId } = req.params;
        const { fromColumnId, toColumnId } = req.body;

        const data = await readData();
        const board = data.boards[boardId];
        
        if (!board?.columns[fromColumnId] || !board?.columns[toColumnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        const taskIndex = board.columns[fromColumnId].tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const [task] = board.columns[fromColumnId].tasks.splice(taskIndex, 1);
        board.columns[toColumnId].tasks.push(task);

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move task' });
    }
});

// Delete task
app.delete('/api/boards/:boardId/columns/:columnId/tasks/:taskId', async (req, res) => {
    try {
        const { boardId, columnId, taskId } = req.params;

        const data = await readData();
        if (!data.boards[boardId]?.columns[columnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        const tasks = data.boards[boardId].columns[columnId].tasks;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }

        tasks.splice(taskIndex, 1);
        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// Update column name
app.put('/api/boards/:boardId/columns/:columnId', async (req, res) => {
    try {
        const { boardId, columnId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Column name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]?.columns[columnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        data.boards[boardId].columns[columnId].name = name;
        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update column' });
    }
});

// Update task
app.put('/api/boards/:boardId/columns/:columnId/tasks/:taskId', async (req, res) => {
    try {
        const { boardId, columnId, taskId } = req.params;
        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]?.columns[columnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        const task = data.boards[boardId].columns[columnId].tasks.find(t => t.id === taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.title = title;
        if (description !== undefined) {
            task.description = description;
        }

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Delete column
app.delete('/api/boards/:boardId/columns/:columnId', async (req, res) => {
    try {
        const { boardId, columnId } = req.params;

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        if (!data.boards[boardId].columns[columnId]) {
            return res.status(404).json({ error: 'Column not found' });
        }

        delete data.boards[boardId].columns[columnId];
        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete column' });
    }
});

// Reorder task within column
app.post('/api/boards/:boardId/columns/:columnId/tasks/reorder', async (req, res) => {
    try {
        const { boardId, columnId } = req.params;
        const { taskId, newIndex } = req.body;

        const data = await readData();
        if (!data.boards[boardId]?.columns[columnId]) {
            return res.status(404).json({ error: 'Board or column not found' });
        }

        const tasks = data.boards[boardId].columns[columnId].tasks;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Remove task from current position and insert at new position
        const [task] = tasks.splice(taskIndex, 1);
        tasks.splice(newIndex, 0, task);

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reorder task' });
    }
});

// Reorder columns
app.post('/api/boards/:boardId/columns/reorder', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { columnOrder } = req.body;

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Create a new columns object with the updated order
        const newColumns = {};
        columnOrder.forEach(columnId => {
            if (data.boards[boardId].columns[columnId]) {
                newColumns[columnId] = data.boards[boardId].columns[columnId];
            }
        });

        // Update the board's columns with the new order
        data.boards[boardId].columns = newColumns;
        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reorder columns' });
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