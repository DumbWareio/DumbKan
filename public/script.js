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
async function loadBoards() {
    console.log('[Debug] loadBoards() called', {
        hasApiCall: typeof window.apiCall === 'function',
        hasAppConfig: typeof window.appConfig === 'object',
        appConfigBasePath: window.appConfig?.basePath,
        stateType: typeof state,
        windowStateType: typeof window.state,
        stateId: state ? `Local state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
        windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
        sameState: window.state === state
    });

    try {
        if (!window.appConfig) {
            console.error('[Debug] Configuration not loaded');
            throw new Error('Configuration not loaded');
        }

        // Add cache-busting parameter
        const timestamp = new Date().getTime();
        const url = `${window.appConfig.basePath}/api/boards?_=${timestamp}`;
        
        console.log('[Debug] Attempting to load boards from:', url);
        
        const data = await window.apiCall(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        console.log('[Debug] Boards API response:', data);

        // Validate the response data
        if (!data || typeof data.boards !== 'object') {
            console.error('[Debug] Invalid boards data:', data);
            throw new Error('Invalid boards data received');
        }

        // Here's the problem: this overwrites the state variable entirely
        // We should merge data into state instead of reassigning
        console.log('[Debug] State before update:', {
            localStateId: state ? `Local state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            sameReference: window.state === state,
            localBoards: state.boards ? Object.keys(state.boards).length : 0,
            windowBoards: window.state?.boards ? Object.keys(window.state.boards).length : 0
        });
        
        // Instead of replacing state, merge the data into the existing state
        if (window.state) {
            // Merge data into window.state instead of replacing
            window.state.boards = data.boards || {};
            window.state.sections = data.sections || {};
            window.state.tasks = data.tasks || {};
            window.state.activeBoard = data.activeBoard;
            
            // Also update local state reference for backward compatibility
            state = window.state;
            
            console.log('[Debug] Using MERGED state update');
        } else {
            // Initialize window.state if it doesn't exist yet
            state = data;
            window.state = state;
            console.log('[Debug] Using DIRECT state update');
        }
        
        console.log('[Debug] State after update:', {
            localStateId: state ? `Local state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            sameReference: window.state === state,
            localBoards: state.boards ? Object.keys(state.boards).length : 0,
            windowBoards: window.state?.boards ? Object.keys(window.state.boards).length : 0
        });

        // Select active board
        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('board');
        
        console.log('[Debug] Board selection:', {
            urlBoardId: boardId,
            availableBoards: Object.keys(state.boards)
        });

        if (boardId && state.boards[boardId]) {
            state.activeBoard = boardId;
        } else {
            const lastActiveBoard = localStorage.getItem('lastActiveBoard');
            if (lastActiveBoard && state.boards[lastActiveBoard]) {
                state.activeBoard = lastActiveBoard;
            } else if (Object.keys(state.boards).length > 0) {
                state.activeBoard = Object.keys(state.boards)[0];
            }
        }
        
        console.log('[Debug] Final board state:', {
            activeBoard: state.activeBoard,
            totalBoards: Object.keys(state.boards).length
        });

        // If we have an active board, load it
        if (state.activeBoard) {
            await window.switchBoard(state.activeBoard);
        }

        // Use window.renderBoards instead of local renderBoards
        window.renderBoards(state, elements);

    } catch (error) {
        console.error('[Debug] Error in loadBoards:', {
            error: error.message,
            stack: error.stack,
            online: navigator.onLine
        });

        // Initialize empty state if loading fails
        state = {
            boards: {},
            sections: {},
            tasks: {},
            activeBoard: null
        };
        
        // Show appropriate error message based on connection status
        if (!navigator.onLine) {
            showError('You are offline. Please check your internet connection.');
        } else {
            showError('Failed to load boards. Please try again later.');
        }
    }
}

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
function initEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Board menu
    elements.boardMenuBtn.addEventListener('click', () => {
        elements.boardMenu.hidden = !elements.boardMenu.hidden;
    });

    // Close board menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.boardMenu.hidden &&
            !elements.boardMenu.contains(e.target) &&
            !elements.boardMenuBtn.contains(e.target)) {
            elements.boardMenu.hidden = true;
        }
    });

    // Add board button
    elements.addBoardBtn.addEventListener('click', () => {
        const name = prompt('Enter board name:');
        if (name) window.createBoard(name);
    });

    // Task modal close button
    const modalClose = elements.taskModal?.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            hideTaskModal();
        });
    }

    // Close task modal when clicking outside
    elements.taskModal?.addEventListener('click', (e) => {
            if (e.target === elements.taskModal) {
                hideTaskModal();
            }
        });
    
    // Delete task button
    if (elements.deleteTaskBtn) {
        elements.deleteTaskBtn.addEventListener('click', () => {
            const taskId = elements.taskForm.dataset.taskId;
            const sectionId = elements.taskForm.dataset.sectionId;
            if (taskId && sectionId && window.deleteTask) {
                window.deleteTask(taskId, sectionId);
            }
        });
    }

    // Task form submission
    elements.taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = elements.taskForm.dataset.taskId;
        const sectionId = elements.taskForm.dataset.sectionId;
        const title = elements.taskTitle.value.trim();
        const description = elements.taskDescription.value.trim();
        const status = elements.taskStatus.value;
        
        // Get raw date values
        const rawDueDate = elements.taskDueDate.value.trim();
        const rawStartDate = elements.taskStartDate.value.trim();
        
        // Only parse dates if they were entered
        let parsedDueDate = null;
        let parsedStartDate = null;
        
        if (rawDueDate) {
            try {
                parsedDueDate = DumbDateParser.parseDate(rawDueDate);
                
                // If no time specified, set to midnight
                if (parsedDueDate && !rawDueDate.toLowerCase().includes('@') && 
                    !rawDueDate.toLowerCase().includes('at') && 
                    !rawDueDate.toLowerCase().includes('am') && 
                    !rawDueDate.toLowerCase().includes('pm')) {
                    parsedDueDate.setHours(0, 0, 0, 0);
                }
            } catch (err) {
                console.error('Error parsing due date:', err);
            }
        }
        
        if (rawStartDate) {
            try {
                parsedStartDate = DumbDateParser.parseDate(rawStartDate);
                
                // If no time specified, set to midnight
                if (parsedStartDate && !rawStartDate.toLowerCase().includes('@') && 
                    !rawStartDate.toLowerCase().includes('at') && 
                    !rawStartDate.toLowerCase().includes('am') && 
                    !rawStartDate.toLowerCase().includes('pm')) {
                    parsedStartDate.setHours(0, 0, 0, 0);
                }
            } catch (err) {
                console.error('Error parsing start date:', err);
            }
        }

        if (!title) return;

        // Prepare the task data
        const taskData = {
            title,
            description,
            status,
            dueDate: parsedDueDate ? parsedDueDate.toISOString() : null,
            startDate: parsedStartDate ? parsedStartDate.toISOString() : null
        };

        try {
            if (taskId) {
                // Update existing task
                const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskData)
                });
                
                if (response.ok) {
                    const updatedTask = await response.json();
                    state.tasks[taskId] = updatedTask;
                    
                    // Refresh the UI with our rendering utilities
                    if (typeof window.refreshBoard === 'function') {
                        window.refreshBoard(state, elements);
                    }
                }
            } else {
                // Create new task using the extracted addTask function
                await window.addTask(sectionId, title, description, status, parsedDueDate, parsedStartDate, state.activeBoard);
            }
            
            window.hideTaskModal();
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    });

    // Add calendar input slide functionality
    window.initCalendarInputSlide(state);

    // Add date input handlers
    const handleDateInput = (input) => {
        const handleDateBlur = () => {
            const value = input.value.trim();
            if (value) {
                const parsedDate = DumbDateParser.parseDate(value);
                if (parsedDate) {
                    input.value = parsedDate.toLocaleDateString();
                }
            }
        };

        input.addEventListener('blur', handleDateBlur);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                handleDateBlur();
            }
        });
        
        // Add touch event handling for mobile
        input.addEventListener('touchend', (e) => {
            if (document.activeElement !== input) {
                handleDateBlur();
            }
        });
    };

    // Apply handlers to date inputs
    handleDateInput(elements.taskDueDate);
    handleDateInput(elements.taskStartDate);
}

// Add function to handle modal closing
function initModalHandlers() {
    // Handle task modal
    if (elements.taskModal) {
        const closeBtn = elements.taskModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideTaskModal());
        }
        
        // Close on backdrop click
        elements.taskModal.addEventListener('click', (e) => {
            if (e.target === elements.taskModal) {
                hideTaskModal();
            }
        });
    }
    
    // Handle confirm modal
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        const closeBtn = confirmModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                confirmModal.classList.add('closing');
                setTimeout(() => {
                    confirmModal.classList.remove('closing');
                    confirmModal.hidden = true;
                }, 300);
            });
        }
        
        // Close on backdrop click
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.classList.add('closing');
                setTimeout(() => {
                    confirmModal.classList.remove('closing');
                    confirmModal.hidden = true;
                }, 300);
            }
        });
        
        // Handle confirm/cancel actions
        const actions = confirmModal.querySelectorAll('[data-action]');
        actions.forEach(button => {
            button.addEventListener('click', () => {
                confirmModal.classList.add('closing');
                setTimeout(() => {
                    confirmModal.classList.remove('closing');
                    confirmModal.hidden = true;
                }, 300);
            });
        });
    }
}

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
    initEventListeners();

    // Add retry logic for loading boards
    let retryCount = 0;
    const maxRetries = 3;

    async function loadBoardsWithRetry() {
        try {
            await loadBoards();
        } catch (error) {
            console.error(`Failed to load boards (attempt ${retryCount + 1}/${maxRetries}):`, error);
            if (retryCount < maxRetries) {
                retryCount++;
                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                await loadBoardsWithRetry();
            } else {
                // Final error handling
                showError('Failed to load boards after multiple attempts');
            }
        }
    }

    await loadBoardsWithRetry();

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
    initModalHandlers();
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
