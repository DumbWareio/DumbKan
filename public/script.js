// All utility functions are now available on the window object
// No need to import them since they're loaded via script tags

// Import render initialization functions
import { initRenderFunctions, refreshUI } from './src/render-init.js';
// deleteSection is now available on window object, no need to import

// State Management
let state = {
    boards: {},
    sections: {},
    tasks: {},
    activeBoard: null
};

// DOM Elements placeholder
let elements = {};

// Task Management Helper Functions
// All task management functions are now in task-utils.js and task-modal.js

// API Logging wrapper
// loggedFetch function has been moved to /public/src/api-utils.js

// Theme Management functions are now in theme.js
// Use window.initTheme and window.toggleTheme

// Board Management
// loadBoards function has been moved to /public/src/data-loading.js
// Import using: import { loadBoards } from './src/data-loading.js'

// Comment indicating this function has been moved to render-utils.js
// Keeping a reference that forwards to the window function
function renderBoards() {
    // Forward to the imported render function
    if (typeof window.renderBoards === 'function') {
        window.renderBoards(state, elements);
    } else {
        console.warn('renderBoards not available');
    }
}

// switchBoard function has been moved to /public/src/board-utils.js
// Import using: import { switchBoard } from './src/board-utils.js';

// createBoard function has been moved to /public/src/board-utils.js
// Import using: import { createBoard } from './src/board-utils.js';

// Column Management (UI terminology)
// addColumn function has been moved to /public/src/board-utils.js
// Import using: import { addColumn } from './src/board-utils.js';

// Task Management
// showTaskModal, hideTaskModal, and addTask functions have been moved to /public/src/task-modal.js
// Import using: import { showTaskModal, hideTaskModal, addTask } from './src/task-modal.js'

// Remove the entire function blocks for showTaskModal, hideTaskMove, and addTask

// Drag and Drop
// handleDragStart function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragStart } from './src/drag-drop-utils.js';

// handleDragEnd function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragEnd } from './src/drag-drop-utils.js';

// handleDragOver function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragOver } from './src/drag-drop-utils.js';

// handleDrop function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDrop } from './src/drag-drop-utils.js';

// Rendering
// Comment indicating this function has been moved to render-utils.js
function renderActiveBoard() {
    // Forward to the imported render function
    if (typeof window.renderActiveBoard === 'function') {
        window.renderActiveBoard(state, elements);
    } else {
        console.warn('renderActiveBoard not available');
    }
}

// Event Listeners
// initEventListeners function has been moved to /public/src/event-listeners.js
// Import using: import { initEventListeners } from './src/event-listeners.js'

// Add function to handle modal closing
// initModalHandlers function has been moved to /public/src/event-listeners.js
// Import using: import { initModalHandlers } from './src/event-listeners.js'

// Initialize the application
async function init() {
    // Initialize DOM elements
    elements = {
        themeToggle: document.getElementById('themeToggle'),
        boardMenu: document.getElementById('boardMenu'),
        boardMenuBtn: document.getElementById('boardMenuBtn'),
        boardList: document.getElementById('boardList'),
        addBoardBtn: document.getElementById('addBoardBtn'),
        currentBoard: document.getElementById('currentBoard'),
        columns: document.getElementById('columns'),
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription'),
        taskStatus: document.getElementById('taskStatus'),
        taskDueDate: document.getElementById('taskDueDate'),
        taskStartDate: document.getElementById('taskStartDate'),
        boardContainer: document.querySelector('.board-container'),
        deleteTaskBtn: document.querySelector('#taskModal .btn-delete')
    };

    // Check required elements
    const requiredElements = [
        'themeToggle', 'boardMenu', 'boardMenuBtn', 'boardList', 
        'addBoardBtn', 'currentBoard', 'columns', 'boardContainer',
        'taskModal', 'taskForm', 'taskTitle', 'taskDescription', 'taskStatus',
        'taskDueDate', 'taskStartDate'
    ];

    for (const key of requiredElements) {
        if (!elements[key]) {
            console.error(`Required element "${key}" not found`);
            return;
        }
    }
    
    // Make state and elements globally available
    window.state = state;
    window.elements = elements;
    
    // Initialize render functions
    initRenderFunctions();
    
    initTheme();
    window.initEventListeners(state, elements);

    // Load boards with retry logic
    await window.loadBoardsWithRetry();

    // Handle credit visibility on scroll
    function handleCreditVisibility() {
        const credit = document.querySelector('.dumbware-credit');
        if (!credit) return;

        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
        credit.classList.toggle('visible', isAtBottom);
    }

    // Add scroll event listener
    window.addEventListener('scroll', handleCreditVisibility, { passive: true });
    window.addEventListener('resize', handleCreditVisibility, { passive: true });

    // Initial check
    handleCreditVisibility();

    // Initialize modal handlers
    window.initModalHandlers(elements);
}

// Add this before initLogin function
const DB_NAME = 'dumbkan-auth';
const DB_VERSION = 1;
const STORE_NAME = 'auth';

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function storeAuthData(pin) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Store PIN with expiration (24 hours)
        await store.put({
            id: 'auth',
            pin,
            expires: Date.now() + (24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error('Failed to store auth data:', error);
    }
}

async function getStoredAuth() {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get('auth');
            
            request.onsuccess = () => {
                const data = request.result;
                if (data && data.expires > Date.now()) {
                    resolve(data);
                } else {
                    // Clear expired data
                    const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                    const deleteStore = deleteTx.objectStore(STORE_NAME);
                    deleteStore.delete('auth');
                    resolve(null);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get stored auth:', error);
        return null;
    }
}

function initLogin() {
    console.log('initLogin starting...', {
        initThemeExists: typeof window.initTheme === 'function',
        windowKeys: Object.keys(window)
    });
    
    // Initialize theme on login page
    initTheme();
    const themeToggleElem = document.getElementById('themeToggle');
    if (themeToggleElem) {
        themeToggleElem.addEventListener('click', toggleTheme);
    }
    
    // Check for stored PIN first
    getStoredAuth().then(authData => {
        if (authData && authData.pin) {
            // Auto verify the stored PIN
            fetch(window.appConfig.basePath + '/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: authData.pin })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    window.location.href = window.appConfig.basePath + '/';
                    return;
                }
                // If verification fails, proceed with normal login
                initPinInputs();
            })
            .catch(() => initPinInputs());
        } else {
            initPinInputs();
        }
    }).catch(() => initPinInputs());
    
    function initPinInputs() {
        // For the login page, fetch the PIN length and generate the input boxes
        fetch(window.appConfig.basePath + '/pin-length')
        .then((response) => response.json())
        .then((data) => {
            const pinLength = data.length;
            const container = document.querySelector('.pin-input-container');
            if (container && pinLength > 0) {
                container.innerHTML = ''; // Clear any preexisting inputs
                const inputs = [];
                for (let i = 0; i < pinLength; i++) {
                    const input = document.createElement('input');
                    input.type = 'password';
                    input.inputMode = 'numeric';
                    input.pattern = '[0-9]*';
                    input.classList.add('pin-input');
                    input.maxLength = 1;
                    input.autocomplete = 'off';
                    container.appendChild(input);
                    inputs.push(input);
                }
                
                // Force focus and show keyboard on mobile
                if (inputs.length > 0) {
                    setTimeout(() => {
                        inputs[0].focus();
                        inputs[0].click();
                    }, 100);
                }
                
                inputs.forEach((input, index) => {
                    input.addEventListener('input', () => {
                        if (input.value.length === 1) {
                            if (index < inputs.length - 1) {
                                inputs[index + 1].focus();
                            } else {
                                // Last digit entered, auto submit the PIN via fetch
                                const pin = inputs.map(inp => inp.value).join('');
                                fetch(window.appConfig.basePath + '/verify-pin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pin })
                                })
                                .then((response) => response.json())
                                .then((result) => {
                                    if (result.success) {
                                        // Store the PIN in IndexedDB
                                        storeAuthData(pin).then(() => {
                                            // Redirect to the index page using the base URL
                                            window.location.href = window.appConfig.basePath + '/';
                                        });
                                    } else {
                                        const errorElem = document.querySelector('.pin-error');
                                        if (result.attemptsLeft === 0) {
                                            if (errorElem) {
                                                errorElem.innerHTML = "Too many invalid attempts - 15 minute lockout";
                                                errorElem.setAttribute('aria-hidden', 'false');
                                            }
                                            // Disable all input fields and grey them out
                                            inputs.forEach(inp => {
                                                inp.value = '';
                                                inp.disabled = true;
                                                inp.style.backgroundColor = "#ddd";
                                            });
                                        } else {
                                            const invalidAttempt = 5 - (result.attemptsLeft || 0);
                                            if (errorElem) {
                                                errorElem.innerHTML = `Invalid PIN entry ${invalidAttempt}/5`;
                                                errorElem.setAttribute('aria-hidden', 'false');
                                            }
                                            // Clear all input fields and refocus the first one
                                            inputs.forEach(inp => inp.value = '');
                                            inputs[0].focus();
                                        }
                                    }
                                })
                                .catch((err) => console.error('Error verifying PIN:', err));
                            }
                        }
                    });
                    
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && input.value === '' && index > 0) {
                            inputs[index - 1].focus();
                        }
                    });
                });
            }
        })
        .catch((err) => console.error('Error fetching PIN length:', err));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('pinForm')) {
        initLogin();
    } else {
        init();
    }
});

// Function makeEditable has been moved to /public/src/ui-utils.js
// Remove the entire function block

// Helper function to convert URLs in text to clickable links and include line breaks
// Function has been moved to /public/src/text-utils.js
// Import using: import { linkify } from './src/text-utils.js'

// Section drag and drop
// handleSectionMove function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionMove } from './src/drag-drop-utils.js';

// handleSectionDragStart function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDragStart } from './src/drag-drop-utils.js';

// handleSectionDragOver function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDragOver } from './src/drag-drop-utils.js';

// handleSectionDrop function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDrop } from './src/drag-drop-utils.js';

// Update renderColumn function to only make the header draggable
// Comment indicating this function has been moved to render-utils.js
function renderColumn(section) {
    // Forward to the imported render function
    if (typeof window.renderColumn === 'function') {
        return window.renderColumn(section, state, elements);
    } else {
        console.warn('renderColumn not available');
        return null;
    }
}

// handleTaskMove function has been moved to /public/src/task-utils.js
// Import using: import { handleTaskMove } from './src/task-utils.js';

// Add this function to handle moving task to the right
// moveTaskRight function has been moved to /public/src/task-utils.js
// Import using: import { moveTaskRight } from './src/task-utils.js';

// Touch event handling for mobile drag and drop
// handleTouchStart, handleTouchMove, and handleTouchEnd functions have been moved to /public/src/touch-drag.js
// Import using: import { handleTouchStart, handleTouchMove, handleTouchEnd } from './src/touch-drag.js';

// Update renderTask to add touch event listeners
// Comment indicating this function has been moved to render-utils.js
function renderTask(task) {
    // Forward to the imported render function
    if (typeof window.renderTask === 'function') {
        return window.renderTask(task, state);
    } else {
        console.warn('renderTask not available');
        return null;
    }
}

// Add back the handleTaskMove function
// handleTaskMove function has been moved to /public/src/task-utils.js
// Import using: import { handleTaskMove } from './src/task-utils.js';

// Add the deleteSection function
// deleteSection function has been moved to /public/src/board-utils.js
// Import using: import { deleteSection } from './src/board-utils.js';

// Add the deleteBoard function
// deleteBoard function has been moved to /public/src/board-utils.js
// Import using: import { deleteBoard } from './src/board-utils.js';

function createInlineTaskEditor(sectionId, addTaskBtn) {
    const editor = document.createElement('div');
    editor.className = 'task-inline-editor';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter task name...';
    input.className = 'task-inline-input';
    editor.appendChild(input);

    // Hide the add task button and insert editor in its place
    addTaskBtn.style.display = 'none';
    addTaskBtn.parentNode.insertBefore(editor, addTaskBtn);

    let isProcessing = false;

    const saveTask = async (keepEditorOpen = false) => {
        if (isProcessing) return;
        isProcessing = true;

        const title = input.value.trim();
        if (title) {
            try {
                // Explicitly pass board ID when calling addTask
                const boardId = state.activeBoard;
                await window.addTask(sectionId, title, '', 'active', null, null, boardId);
                if (keepEditorOpen) {
                    input.value = '';
                    input.focus();
                } else {
                    closeEditor();
                }
            } catch (error) {
                console.error('Error adding task:', error);
                closeEditor();
            }
        } else {
            closeEditor();
        }
        isProcessing = false;
    };

    const closeEditor = () => {
        editor.remove();
        addTaskBtn.style.display = '';
    };

    let blurTimeout;
    input.addEventListener('blur', () => {
        // Delay the blur handling to allow the Enter keydown to prevent it
        blurTimeout = setTimeout(() => saveTask(false), 100);
    });

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(blurTimeout); // Prevent blur from triggering
            await saveTask(true);
        } else if (e.key === 'Escape') {
            clearTimeout(blurTimeout); // Prevent blur from triggering
            closeEditor();
        }
    });

    input.focus();
}

// Add this function to handle calendar input slide functionality
// initCalendarInputSlide function has been moved to /public/src/ui-utils.js
// Import using: import { initCalendarInputSlide } from './src/ui-utils.js'

// formatDateHumanReadable function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// formatDueDate function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// isPastDue function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// API call wrapper with retry logic

// Load boards with retry

// Show error message

// Create error container if it doesn't exist

// Add error message styles

// Expose necessary functions to window for other modules to use
// Note: handleTaskMove function has been moved to task-utils.js and is exposed on the window there
// Note: handleTouchStart, handleTouchMove, and handleTouchEnd functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: handleDragStart, handleDragEnd, handleDragOver, handleDrop functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: handleSectionMove, handleSectionDragStart, handleSectionDragOver, handleSectionDrop functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: deleteSection, deleteBoard, createBoard, switchBoard, and addColumn functions have been moved to board-utils.js and are exposed on the window there
window.loadBoards = loadBoards;
window.createInlineTaskEditor = createInlineTaskEditor;
window.renderColumn = renderColumn;
window.renderTask = renderTask;
