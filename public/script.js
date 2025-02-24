// All utility functions are now available on the window object
// No need to import them since they're loaded via script tags

// Import render initialization functions
import { initRenderFunctions, refreshUI } from './src/render-init.js';

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
            await switchBoard(state.activeBoard);
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

async function switchBoard(boardId) {
    if (!state.boards[boardId]) return;
    
    state.activeBoard = boardId;
    localStorage.setItem('lastActiveBoard', boardId);
    
    // Update URL without reloading the page
    const url = new URL(window.location);
    url.searchParams.set('board', boardId);
    window.history.pushState({}, '', url);
    
    // Use window render functions
    window.renderBoards(state, elements);
    window.renderActiveBoard(state, elements);
    
    // Update page title
    document.title = `${state.boards[boardId].name || 'Unnamed Board'} - DumbKan`;
}

async function createBoard(name) {
    try {
        const response = await loggedFetch(window.appConfig.basePath + '/api/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            const board = await response.json();
            state.boards[board.id] = board;
            window.renderBoards(state, elements);
            switchBoard(board.id);
        }
    } catch (error) {
        console.error('Failed to create board:', error);
    }
}

// Column Management (UI terminology)
async function addColumn(boardId) {
    const name = prompt('Enter column name:');
    if (!name) return;

    try {
        const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${boardId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            const section = await response.json();
            state.sections[section.id] = section;
            state.boards[boardId].sectionOrder.push(section.id);
            window.renderActiveBoard(state, elements);
        }
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

// Task Management
// showTaskModal, hideTaskModal, and addTask functions have been moved to /public/src/task-modal.js
// Import using: import { showTaskModal, hideTaskModal, addTask } from './src/task-modal.js'

// Remove the entire function blocks for showTaskModal, hideTaskModal, and addTask

// Drag and Drop
function handleDragStart(e) {
    const task = e.target.closest('.task');
    const columnHeader = e.target.closest('.column-header');
    
    if (task && !columnHeader) {
    task.classList.add('dragging');
    e.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.dataset.taskId,
            sourceSectionId: task.closest('.column').dataset.sectionId,
            type: 'task'
        }));
    } else if (columnHeader) {
        const column = columnHeader.closest('.column');
        if (column) {
            column.classList.add('dragging');
            e.dataTransfer.setData('application/json', JSON.stringify({
                sectionId: column.dataset.sectionId,
                type: 'section'
            }));
        }
    }
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    document.querySelectorAll('.task.dragging, .column.dragging').forEach(el => {
        el.classList.remove('dragging');
    });
    document.querySelectorAll('.column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const column = e.target.closest('.column');
    if (!column) return;
    
    // Get clientX from either touch or mouse event
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
    const draggingTask = document.querySelector('.task.dragging');
    if (draggingTask) {
        column.classList.add('drag-over');
        const tasksContainer = column.querySelector('.tasks');
        if (!tasksContainer) return;
    
        const siblings = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            return clientY < rect.top + rect.height / 2;
        });
    
        if (nextSibling) {
            tasksContainer.insertBefore(draggingTask, nextSibling);
        } else {
            tasksContainer.appendChild(draggingTask);
        }
    } else {
        const draggingColumn = document.querySelector('.column.dragging');
        if (draggingColumn) {
            const columns = [...document.querySelectorAll('.column:not(.dragging)')];
            const afterElement = getDragAfterElement(columns, clientX);
            
            if (afterElement) {
                column.parentNode.insertBefore(draggingColumn, afterElement);
            } else {
                column.parentNode.appendChild(draggingColumn);
            }
        }
    }
}

async function handleDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;
    
    column.classList.remove('drag-over');
    
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        
        if (data.type === 'task') {
            const { taskId, sourceSectionId, toSectionId, newIndex: providedIndex } = data;
            const targetSectionId = toSectionId || column.dataset.sectionId;
            const tasksContainer = column.querySelector('.tasks');
            if (!tasksContainer) return;
        
        const task = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!task) return;
        
            let newIndex = providedIndex;
            if (typeof newIndex !== 'number') {
                const siblings = [...tasksContainer.querySelectorAll('.task')];
                newIndex = siblings.indexOf(task);
            }

            await handleTaskMove(taskId, sourceSectionId, targetSectionId, newIndex);
        } else if (data.type === 'section') {
            const { sectionId } = data;
            const columns = [...document.querySelectorAll('.column')];
            const newIndex = columns.indexOf(column);
            
            if (newIndex !== -1) {
                await handleSectionMove(sectionId, newIndex);
            }
        }
    } catch (error) {
        console.error('Error handling drop:', error);
        loadBoards();
    }
}

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
        if (name) createBoard(name);
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
    initCalendarInputSlide();

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
async function handleSectionMove(sectionId, newIndex) {
    try {
        const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newIndex })
        });

        if (!response.ok) {
            throw new Error('Failed to move section');
        }

        // Update local state
        const board = state.boards[state.activeBoard];
        const currentIndex = board.sectionOrder.indexOf(sectionId);
        if (currentIndex !== -1) {
            board.sectionOrder.splice(currentIndex, 1);
            board.sectionOrder.splice(newIndex, 0, sectionId);
        }

        // Use the window function for rendering
        if (typeof window.renderActiveBoard === 'function') {
            window.renderActiveBoard(state, elements);
        } else {
            console.warn('renderActiveBoard not available');
        }
    } catch (error) {
        console.error('Failed to move section:', error);
        loadBoards(); // Reload the board state in case of error
    }
}

function handleSectionDragStart(e) {
    const column = e.target.closest('.column');
    if (!column) return;
    
    column.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
        sectionId: column.dataset.sectionId,
        type: 'section'
        }));
        e.dataTransfer.effectAllowed = 'move';
}

function handleSectionDragOver(e) {
    e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;

    const draggingElement = document.querySelector('.column.dragging');
    if (!draggingElement) return;

    const columns = [...document.querySelectorAll('.column:not(.dragging)')];
    const afterElement = getDragAfterElement(columns, e.clientX);
    
    if (afterElement) {
        column.parentNode.insertBefore(draggingElement, afterElement);
    } else {
        column.parentNode.appendChild(draggingElement);
    }
}

function getDragAfterElement(elements, x) {
    const draggableElements = elements.filter(element => {
        const box = element.getBoundingClientRect();
        return x < box.left + box.width / 2;
    });
    
    return draggableElements[0];
}

async function handleSectionDrop(e) {
                e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;

    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type !== 'section') return;

        const { sectionId } = data;
        const columns = [...document.querySelectorAll('.column')];
        const newIndex = columns.indexOf(column);
        
        if (newIndex !== -1) {
            await handleSectionMove(sectionId, newIndex);
                    }
        } catch (error) {
        console.error('Error handling section drop:', error);
        loadBoards();
    }
}

// Update renderColumn function to only make the header draggable
function renderColumn(section) {
    if (!section) return null;

    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.sectionId = section.id;
    columnEl.draggable = false; // Column itself is not draggable

    // Add drag event listeners for tasks and sections
    columnEl.addEventListener('dragover', handleDragOver);
    columnEl.addEventListener('drop', handleDrop);
    columnEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (document.querySelector('.task.dragging')) {
            columnEl.classList.add('drag-over');
        }
    });
    columnEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!e.relatedTarget || !columnEl.contains(e.relatedTarget)) {
            columnEl.classList.remove('drag-over');
        }
    });

    // Ensure taskIds exists and is an array
    const taskIds = Array.isArray(section.taskIds) ? section.taskIds : [];
    const taskCount = taskIds.length;

    const headerEl = document.createElement('div');
    headerEl.className = 'column-header';
    headerEl.draggable = true; // Only the header is draggable
    headerEl.setAttribute('draggable', true);
    
    // Add touch support for mobile drag and drop
    headerEl.addEventListener('touchstart', function(e) {
        // Create a synthetic event with a minimal dataTransfer polyfill
        const syntheticEvent = {
            target: headerEl,
            dataTransfer: {
                setData: (type, val) => { headerEl.dataset.dragData = val; },
                effectAllowed: 'move'
            },
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            preventDefault: () => {}
        };
        // Invoke the existing drag start handler
        handleDragStart(syntheticEvent);
    });

    // Add touchmove listener to simulate dragover
    headerEl.addEventListener('touchmove', function(e) {
        e.preventDefault(); // Prevent scrolling while dragging
        const syntheticEvent = {
            target: e.target,
            touches: e.touches,
            preventDefault: () => {},
            dataTransfer: {
                effectAllowed: 'move'
            }
        };
        handleDragOver(syntheticEvent);
    });

    // Add touchend listener to simulate drop
    headerEl.addEventListener('touchend', function(e) {
        const touch = e.changedTouches[0];
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        if (dropTarget) {
            const syntheticEvent = {
                target: dropTarget,
                preventDefault: () => {},
                dataTransfer: {
                    getData: () => headerEl.dataset.dragData
                }
            };
            handleDrop(syntheticEvent);
        }
        // Clean up
        headerEl.classList.remove('dragging');
    });
    
    const columnTitle = document.createElement('h2');
    columnTitle.className = 'column-title';
    columnTitle.textContent = section.name || 'Unnamed Section';
    makeEditable(columnTitle, async (newName) => {
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${section.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
                });
                
                if (response.ok) {
                const updatedSection = await response.json();
                state.sections[section.id] = updatedSection;
                    return true;
                }
                return false;
            } catch (error) {
            console.error('Failed to update section name:', error);
                return false;
            }
        }, state);
        
    headerEl.innerHTML = `
        <div class="column-count">${taskCount}</div>
        <div class="column-drag-handle">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
    `;
    headerEl.insertBefore(columnTitle, headerEl.lastElementChild);

    // Add drag event listeners to the header
    headerEl.addEventListener('dragstart', handleSectionDragStart);
    headerEl.addEventListener('dragend', () => columnEl.classList.remove('dragging'));

    columnEl.appendChild(headerEl);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'tasks';
    tasksContainer.dataset.sectionId = section.id;
    columnEl.appendChild(tasksContainer);

    // Render tasks
    taskIds.forEach(taskId => {
        const task = state.tasks?.[taskId];
        if (task) {
            const taskEl = renderTask(task);
            if (taskEl) {
                tasksContainer.appendChild(taskEl);
            }
        }
    });

    // Add task button
    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-task-btn';
    addTaskBtn.setAttribute('aria-label', 'Add task');
    addTaskBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addTaskBtn.addEventListener('click', () => {
        createInlineTaskEditor(section.id, addTaskBtn);
    });
    columnEl.appendChild(addTaskBtn);

    return columnEl;
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
function renderTask(task) {
    if (!task) return null;

    const taskElement = document.createElement('div');
    taskElement.className = 'task';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.sectionId = task.sectionId;
    taskElement.draggable = true;  // Add this line to make tasks draggable

    // Add drag handle with simpler icon
    const dragHandle = document.createElement('div');
    dragHandle.className = 'task-drag-handle';
    dragHandle.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    taskElement.appendChild(dragHandle);

    // Create main content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'task-content-wrapper';

    // Create task title
    const taskTitle = document.createElement('h3');
    taskTitle.className = 'task-title';
    const titleText = document.createElement('span');
    titleText.className = 'title-text';
    titleText.textContent = task.title || 'Untitled Task';
    makeEditable(titleText, async (newTitle) => {
        try {
            const updatedTask = await updateTask(task, { title: newTitle });
            if (updatedTask) {
                state.tasks[task.id] = updatedTask;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task title:', error);
            return false;
        }
    }, state);
    taskTitle.appendChild(titleText);
    contentWrapper.appendChild(taskTitle);

    // Create badges container
    const metadataBadges = document.createElement('div');
    metadataBadges.className = 'task-badges';

    // Add status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge status-badge ${task.status || 'active'}`;
    statusBadge.setAttribute('title', (task.status || 'active').charAt(0).toUpperCase() + (task.status || 'active').slice(1));
    statusBadge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newStatus = task.status === 'active' ? 'inactive' : 'active';
        try {
            const updatedTask = await updateTask(task, { status: newStatus });
            if (updatedTask) {
                state.tasks[task.id] = updatedTask;
                statusBadge.className = `badge status-badge ${newStatus}`;
                statusBadge.setAttribute('title', newStatus.charAt(0).toUpperCase() + newStatus.slice(1));
                task.status = newStatus;
            }
        } catch (error) {
            console.error('Failed to update task status:', error);
        }
    });
    metadataBadges.appendChild(statusBadge);

    // Add info badge
    const infoBadge = document.createElement('span');
    infoBadge.className = 'badge info-badge';
    infoBadge.textContent = 'i';
    infoBadge.setAttribute('title', 'View Task Details');
    infoBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskModal(task);
    });
    metadataBadges.appendChild(infoBadge);

    // Add priority badge
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge priority-badge ${task.priority}`;
    priorityBadge.setAttribute('title', task.priority.charAt(0).toUpperCase() + task.priority.slice(1));
    priorityBadge.textContent = getPrioritySymbol(task.priority);

    // Create priority tray
    const priorityTray = document.createElement('div');
    priorityTray.className = 'priority-tray';
    
    const priorities = [
        { name: 'low', symbol: '↓' },
        { name: 'medium', symbol: '-' },
        { name: 'high', symbol: '↑' },
        { name: 'urgent', symbol: '!' }
    ];
    
    priorities.forEach(priority => {
        const option = document.createElement('div');
        option.className = `priority-option ${priority.name}`;
        option.textContent = priority.symbol;
        option.setAttribute('title', priority.name.charAt(0).toUpperCase() + priority.name.slice(1));
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const updatedTask = await updateTask(task, { priority: priority.name });
                if (updatedTask) {
                    state.tasks[task.id] = updatedTask;
                    renderActiveBoard();
                }
            } catch (error) {
                console.error('Failed to update task priority:', error);
            }
            priorityTray.classList.remove('active');
        });
        priorityTray.appendChild(option);
    });
    
    priorityBadge.appendChild(priorityTray);
    priorityBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        const allTrays = document.querySelectorAll('.priority-tray');
        allTrays.forEach(tray => {
            if (tray !== priorityTray) {
                tray.classList.remove('active');
            }
        });
        priorityTray.classList.toggle('active');
    });
    metadataBadges.appendChild(priorityBadge);

    // Add calendar badge
    const calendarBadge = document.createElement('div');
    calendarBadge.className = 'calendar-badge' + (task.dueDate ? ' has-due-date' : '');
    if (task.dueDate && isPastDue(task.dueDate)) {
        calendarBadge.classList.add('past-due');
    }

    // Create date input
    const dateInput = document.createElement('input');
    dateInput.type = 'text';
    dateInput.className = 'calendar-date-input';
    dateInput.placeholder = 'Enter due date';
    dateInput.hidden = true;
    if (task.dueDate) {
        dateInput.value = new Date(task.dueDate).toISOString().split('T')[0];
    }

    // Add focus handler to select all text
    dateInput.addEventListener('focus', (e) => {
        e.target.select();
    });

    // Create calendar icon
    const calendarIcon = document.createElement('div');
    calendarIcon.className = 'calendar-icon';
    calendarIcon.innerHTML = task.dueDate ? formatDueDate(task.dueDate) : '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 2v3M16 2v3M3.5 8h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Add elements to badge
    calendarBadge.appendChild(dateInput);
    calendarBadge.appendChild(calendarIcon);

    // Toggle input on icon click
    calendarIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        dateInput.hidden = !dateInput.hidden;
        if (!dateInput.hidden) {
            dateInput.focus();
        }
    });

    // Handle date saving
    const saveDueDate = async () => {
        const inputValue = dateInput.value.trim();
        let parsedDate = null;
        
        if (inputValue) {
            try {
                parsedDate = DumbDateParser.parseDate(inputValue);
                if (!parsedDate) return;
                
                // If no time specified, set to midnight
                if (!inputValue.toLowerCase().includes('@') && 
                    !inputValue.toLowerCase().includes('at') && 
                    !inputValue.toLowerCase().includes('am') && 
                    !inputValue.toLowerCase().includes('pm')) {
                    parsedDate.setHours(0, 0, 0, 0);
                }
            } catch (err) {
                console.error('Error parsing due date:', err);
                return;
            }
        }

        const updatedTask = await updateTask(task, { dueDate: parsedDate ? parsedDate.toISOString() : null });
        if (updatedTask) {
            // Update calendar badge display
            calendarIcon.innerHTML = updatedTask.dueDate ? formatDueDate(updatedTask.dueDate) : '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 2v3M16 2v3M3.5 8h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            calendarBadge.classList.toggle('has-due-date', !!parsedDate);
            calendarBadge.classList.toggle('past-due', parsedDate && isPastDue(parsedDate));
        }
        dateInput.hidden = true;
    };

    // Handle input blur
    dateInput.addEventListener('blur', saveDueDate);

    // Handle Enter and Escape keys
    dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveDueDate();
        } else if (e.key === 'Escape') {
            dateInput.hidden = true;
        }
    });

    metadataBadges.appendChild(calendarBadge);

    // Add badges to content wrapper
    contentWrapper.appendChild(metadataBadges);

    // Add description or arrow hook
    if (task.description) {
        const taskDescription = document.createElement('div');
        taskDescription.className = 'task-description';
        taskDescription.innerHTML = linkify(task.description);
        makeEditable(taskDescription, async (newDescription) => {
            try {
                const updatedTask = await updateTask(task, { description: newDescription });
                if (updatedTask) {
                    state.tasks[task.id] = updatedTask;
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to update task description:', error);
                return false;
            }
        }, state);
        contentWrapper.appendChild(taskDescription);
    } else {
        const descriptionHook = document.createElement('div');
        descriptionHook.className = 'description-hook';
        descriptionHook.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;
        descriptionHook.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskDescription = document.createElement('div');
            taskDescription.className = 'task-description';
            const textarea = document.createElement('textarea');
            textarea.className = 'inline-edit';
            textarea.placeholder = 'Add a description...';
            
            const saveDescription = async () => {
                const newDescription = textarea.value.trim();
                try {
                    const updatedTask = await updateTask(task, { description: newDescription });
                    if (updatedTask) {
                        state.tasks[task.id] = updatedTask;
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error('Failed to add task description:', error);
                    return false;
                }
            };

            textarea.addEventListener('blur', saveDescription);
            textarea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    textarea.blur();
                } else if (e.key === 'Escape') {
                    renderActiveBoard();
                }
            });

            taskDescription.appendChild(textarea);
            contentWrapper.appendChild(taskDescription);
            textarea.focus();
        });
        contentWrapper.appendChild(descriptionHook);
    }

    taskElement.appendChild(contentWrapper);

    // Add move right button
    const moveRightBtn = document.createElement('button');
    moveRightBtn.className = 'task-move';
    moveRightBtn.setAttribute('aria-label', 'Move task right');
    moveRightBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    `;
    moveRightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTaskRight(task.id, task.sectionId);
    });

    // Only show the move right button if there's a section to the right
    const board = state.boards[state.activeBoard];
    if (board && board.sectionOrder) {
        const currentSectionIndex = board.sectionOrder.indexOf(task.sectionId);
        if (currentSectionIndex === -1 || currentSectionIndex >= board.sectionOrder.length - 1) {
            moveRightBtn.style.visibility = 'hidden';
        }
    }

    taskElement.appendChild(moveRightBtn);

    // Add event listeners
    taskElement.addEventListener('dragstart', handleDragStart);
    taskElement.addEventListener('dragend', handleDragEnd);
    taskElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    taskElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    taskElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return taskElement;
}

// Add back the handleTaskMove function
// handleTaskMove function has been moved to /public/src/task-utils.js
// Import using: import { handleTaskMove } from './src/task-utils.js';

// Add the deleteSection function
async function deleteSection(sectionId) {
    try {
        const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            delete state.sections[sectionId];
            const board = state.boards[state.activeBoard];
            if (board) {
                const sectionIndex = board.sectionOrder.indexOf(sectionId);
                if (sectionIndex !== -1) {
                    board.sectionOrder.splice(sectionIndex, 1);
                }
                const section = state.sections[sectionId];
                if (section && Array.isArray(section.taskIds)) {
                    section.taskIds.forEach(taskId => delete state.tasks[taskId]);
                }
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting section:', error);
        return false;
    }
}

// Add the deleteBoard function
async function deleteBoard(boardId) {
    try {
        const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${boardId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            Object.entries(state.sections).forEach(([sectionId, section]) => {
                if (section.boardId === boardId) {
                    section.taskIds.forEach(taskId => delete state.tasks[taskId]);
                    delete state.sections[sectionId];
                }
            });
            delete state.boards[boardId];
            if (state.activeBoard === boardId) {
                const remainingBoards = Object.keys(state.boards);
                state.activeBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting board:', error);
        return false;
    }
}

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
function initCalendarInputSlide() {
    const calendarBadges = document.querySelectorAll('.calendar-badge');
    
    calendarBadges.forEach(badge => {
        const badgeSvg = badge.querySelector('svg');
        
        // Create date tray
        const dateTray = document.createElement('div');
        dateTray.className = 'calendar-date-tray';
        
        // Create input
        const dateInput = document.createElement('input');
        dateInput.type = 'text';
        dateInput.placeholder = 'Enter due date';
        
        // Add focus handler to select all text
        dateInput.addEventListener('focus', (e) => {
            e.target.select(); // Select all text when focused
        });
        
        // Append input to tray
        dateTray.appendChild(dateInput);
        
        // Position the tray relative to the badge
        badge.style.position = 'relative';
        badge.appendChild(dateTray);
        
        // Toggle tray
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Close any other open date trays
            const allDateTrays = document.querySelectorAll('.calendar-date-tray.open');
            allDateTrays.forEach(tray => {
                if (tray !== dateTray) {
                    tray.classList.remove('open');
                }
            });
            
            // Toggle this tray
            dateTray.classList.toggle('open');
            
            // Focus the input when opening
            if (dateTray.classList.contains('open')) {
                dateInput.focus();
                
                // Set the current task's due date if it exists
                const taskElement = badge.closest('.task');
                const taskId = taskElement.dataset.taskId;
                const task = state.tasks[taskId];
                
                if (task && task.dueDate) {
                    dateInput.value = new Date(task.dueDate).toLocaleDateString();
                }
            }
        });
        
        // Handle input interactions
        dateInput.addEventListener('blur', async () => {
            const inputValue = dateInput.value.trim();
            
            // Dumb date parsing - if it works, it works!
            let parsedDate = null;
            if (inputValue) {
                parsedDate = DumbDateParser.parseDate(inputValue);
            }
            
            // If we got a date, use it. If not, no date!
            const response = await loggedFetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${task.sectionId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dueDate: parsedDate ? parsedDate.toISOString() : null })
            });
            
            if (response.ok) {
                const updatedTask = await response.json();
                state.tasks[task.id] = updatedTask;
                
                // Show it worked
                badge.classList.toggle('has-due-date', !!parsedDate);
                badge.setAttribute('title', parsedDate ? `Due: ${parsedDate.toLocaleDateString()}` : 'No due date');
                
                // Close it
                dateTray.classList.remove('open');
            }
        });
        
        // Handle Enter and Escape keys
        dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dateInput.blur(); // This will trigger the save logic
            } else if (e.key === 'Escape') {
                dateTray.classList.remove('open');
            }
        });
    });
    
    // Close tray when clicking outside
    document.addEventListener('click', (event) => {
        const openDateTrays = document.querySelectorAll('.calendar-date-tray.open');
        openDateTrays.forEach(tray => {
            const isClickInsideTray = tray.contains(event.target);
            const isClickOnCalendarBadge = Array.from(document.querySelectorAll('.calendar-badge')).some(badge => badge.contains(event.target));
            
            if (!isClickInsideTray && !isClickOnCalendarBadge) {
                tray.classList.remove('open');
            }
        });
    });
}

// Add this helper function at the top level
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
// Note: handleTouchStart, handleTouchMove, and handleTouchEnd functions have been moved to touch-drag.js and are exposed on the window there
window.loadBoards = loadBoards;
window.addColumn = addColumn;
window.switchBoard = switchBoard;
window.createBoard = createBoard;
window.handleSectionMove = handleSectionMove;
window.handleDragStart = handleDragStart;
window.handleDragEnd = handleDragEnd;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleSectionDragStart = handleSectionDragStart;
window.createInlineTaskEditor = createInlineTaskEditor;
window.deleteSection = deleteSection;
window.deleteBoard = deleteBoard;
