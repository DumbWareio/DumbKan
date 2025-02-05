// State Management
let state = {
    boards: {},
    sections: {},
    tasks: {},
    activeBoard: null
};

// DOM Elements placeholder
let elements = {};

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Board Management
async function loadBoards() {
    try {
        if (!window.appConfig) {
            console.error('Configuration not loaded');
            return;
        }

        // Add cache-busting query parameter and no-cache headers
        const response = await fetch(`${window.appConfig.basePath}/api/boards?_t=${Date.now()}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.offline) {
                console.warn('Application is offline, using cached data if available');
                // Continue with empty state but don't show error
                state = {
                    boards: {},
                    sections: {},
                    tasks: {},
                    activeBoard: null
                };
                renderBoards();
                return;
            }
            throw new Error(`Failed to load boards: ${response.status} - ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        // Validate the data structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data structure received');
        }

        // Initialize state with empty objects if they don't exist
        state = {
            boards: data.boards || {},
            sections: data.sections || {},
            tasks: data.tasks || {},
            activeBoard: data.activeBoard || null
        };
        
        // Ensure we have a valid active board
        if (!state.activeBoard || !state.boards[state.activeBoard]) {
            const firstBoard = Object.keys(state.boards)[0];
            if (firstBoard) {
                state.activeBoard = firstBoard;
            }
        }

        // Only render if we have valid data
        if (Object.keys(state.boards).length > 0) {
            renderBoards();
            renderActiveBoard();
        } else {
            console.warn('No boards found in the loaded data');
            // Initialize empty state but still render to show empty state
            state = {
                boards: {},
                sections: {},
                tasks: {},
                activeBoard: null
            };
            renderBoards();
        }
    } catch (error) {
        console.error('Failed to load boards:', error);
        // Initialize empty state on error
        state = {
            boards: {},
            sections: {},
            tasks: {},
            activeBoard: null
        };
        
        // Show offline message if appropriate
        if (!navigator.onLine) {
            console.warn('Browser is offline, using empty state');
        }
        
        renderBoards();
        
        // Update UI to show error state
        if (elements.currentBoard) {
            elements.currentBoard.textContent = navigator.onLine ? 'Error Loading Boards' : 'Offline';
        }
    }
}

function renderBoards() {
    if (!elements.boardList) return;
    
    elements.boardList.innerHTML = '';
    if (!state.boards) return;

    Object.values(state.boards).forEach(board => {
        if (!board) return;
        
        const li = document.createElement('li');
        li.textContent = board.name || 'Unnamed Board';
        li.dataset.boardId = board.id;
        if (board.id === state.activeBoard) li.classList.add('active');
        li.addEventListener('click', () => switchBoard(board.id));
        elements.boardList.appendChild(li);
    });
}

async function switchBoard(boardId) {
    try {
        const response = await fetch(window.appConfig.basePath + '/api/boards/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boardId })
        });
        if (response.ok) {
            state.activeBoard = boardId;
            elements.currentBoard.textContent = state.boards[boardId].name;
            renderActiveBoard();
            elements.boardMenu.hidden = true;
        }
    } catch (error) {
        console.error('Failed to switch board:', error);
    }
}

async function createBoard(name) {
    try {
        const response = await fetch(window.appConfig.basePath + '/api/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            const board = await response.json();
            state.boards[board.id] = board;
            renderBoards();
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
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${boardId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            const section = await response.json();
            state.sections[section.id] = section;
            state.boards[boardId].sectionOrder.push(section.id);
            renderActiveBoard();
        }
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

// Task Management
function showTaskModal(task) {
    if (!elements.taskModal) return;
    
    const isNewTask = !task.id;
    elements.taskModal.querySelector('h2').textContent = isNewTask ? 'Add Task' : 'Edit Task';
    elements.taskTitle.value = isNewTask ? '' : task.title;
    elements.taskDescription.value = isNewTask ? '' : (task.description || '');
    elements.taskForm.dataset.taskId = task.id || '';
    elements.taskForm.dataset.sectionId = task.sectionId;
    
    // Show/hide delete button based on whether it's a new task
    const deleteBtn = elements.taskModal.querySelector('.btn-delete');
    if (deleteBtn) {
        deleteBtn.hidden = isNewTask;
        deleteBtn.classList.remove('confirm');
        // Update button content to include check icon
        deleteBtn.innerHTML = `
            <span class="button-text">Delete Task</span>
            <svg class="confirm-check" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        let confirmTimeout;
        deleteBtn.onclick = isNewTask ? null : (e) => {
            if (!deleteBtn.classList.contains('confirm')) {
                e.preventDefault();
                deleteBtn.classList.add('confirm');
                deleteBtn.querySelector('.button-text').textContent = 'You Sure?';
                // Reset confirmation state after 3 seconds
                confirmTimeout = setTimeout(() => {
                    deleteBtn.classList.remove('confirm');
                    deleteBtn.querySelector('.button-text').textContent = 'Delete Task';
                }, 3000);
            } else {
                clearTimeout(confirmTimeout);
                deleteBtn.classList.remove('confirm');
                deleteTask(task.id, task.sectionId);
            }
        };
        // Reset confirmation state when modal is closed
        const resetConfirmation = () => {
            clearTimeout(confirmTimeout);
            deleteBtn.classList.remove('confirm');
            deleteBtn.querySelector('.button-text').textContent = 'Delete Task';
        };
        elements.taskModal.querySelector('.modal-close').addEventListener('click', resetConfirmation);
        elements.taskForm.addEventListener('submit', resetConfirmation);
    }
    
    elements.taskModal.hidden = false;
    elements.taskTitle.focus();
}

function hideTaskModal() {
    if (!elements.taskModal) return;
    const deleteBtn = elements.taskModal.querySelector('.btn-delete');
    if (deleteBtn) {
        deleteBtn.classList.remove('confirm');
    }
    elements.taskModal.hidden = true;
    elements.taskForm.reset();
    delete elements.taskForm.dataset.taskId;
    delete elements.taskForm.dataset.sectionId;
}

async function addTask(sectionId, title, description = '') {
    try {
        if (!sectionId) {
            console.error('Section ID is required to add a task');
            return;
        }
        
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to add task: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Make sure the section exists in state
        if (!state.sections[sectionId]) {
            console.error('Section not found in state:', sectionId);
            return;
        }
        
        state.tasks[data.id] = data;
        state.sections[sectionId].taskIds.push(data.id);
        renderActiveBoard();
    } catch (error) {
        console.error('Failed to add task:', error);
    }
}

// Drag and Drop
async function handleTaskMove(taskId, fromSectionId, toSectionId, newIndex) {
    try {
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/tasks/${taskId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromSectionId,
                toSectionId,
                newIndex
            })
        });

        if (!response.ok) {
            throw new Error('Failed to move task');
        }

        // Update local state
        const task = state.tasks[taskId];
        const fromSection = state.sections[fromSectionId];
        const toSection = state.sections[toSectionId];

        // Remove task from source section
        const taskIndex = fromSection.taskIds.indexOf(taskId);
        if (taskIndex !== -1) {
            fromSection.taskIds.splice(taskIndex, 1);
        }

        // Add task to target section
        if (typeof newIndex === 'number') {
            toSection.taskIds.splice(newIndex, 0, taskId);
        } else {
            toSection.taskIds.push(taskId);
        }

        // Update task's section reference
        task.sectionId = toSectionId;

        renderActiveBoard();
    } catch (error) {
        console.error('Failed to move task:', error);
        loadBoards(); // Reload the board state in case of error
    }
}

function handleDragStart(e) {
    const task = e.target.closest('.task');
    if (!task) return;
    
    task.classList.add('dragging');
    // Store both the task ID and its original section ID using application/json
    e.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.dataset.taskId,
        sourceSectionId: task.closest('.column').dataset.sectionId
    }));
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    const task = e.target.closest('.task');
    if (!task) return;
    task.classList.remove('dragging');
    
    // Remove drag-over class from all columns
    document.querySelectorAll('.column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const column = e.target.closest('.column');
    if (!column) return;
    
    // Add drag-over class to the column
    column.classList.add('drag-over');
    
    const tasksContainer = column.querySelector('.tasks');
    const draggingTask = document.querySelector('.task.dragging');
    if (!draggingTask) return;
    
    const siblings = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
    const nextSibling = siblings.find(sibling => {
        const rect = sibling.getBoundingClientRect();
        const offset = e.clientY - rect.top - rect.height / 2;
        return offset < 0;
    });
    
    if (nextSibling) {
        tasksContainer.insertBefore(draggingTask, nextSibling);
    } else {
        tasksContainer.appendChild(draggingTask);
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const column = e.target.closest('.column');
    if (!column) return;
    
    // Remove drag-over class
    column.classList.remove('drag-over');
    
    try {
        // Get the task data from the drag event
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { taskId, sourceSectionId } = data;
        
        const task = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!task) return;
        
        const targetSectionId = column.dataset.sectionId;
        
        console.log(`Moving task ${taskId} from section ${sourceSectionId} to section ${targetSectionId}`);
        
        // Check if we have access to the required state
        if (!state.sections[sourceSectionId] || !state.sections[targetSectionId]) {
            console.error('Invalid section state');
            return;
        }

        const sourceSection = state.sections[sourceSectionId];
        const targetSection = state.sections[targetSectionId];

        if (!sourceSection?.taskIds || !targetSection?.taskIds) {
            console.error('Invalid section state');
            return;
        }

        const tasksContainer = column.querySelector('.tasks');
        const siblings = [...tasksContainer.querySelectorAll('.task')];
        const newIndex = siblings.indexOf(task);
        
        if (sourceSectionId === targetSectionId) {
            // Same section reordering - use move endpoint with same source/target section
            const taskObj = state.tasks[taskId];
            if (!taskObj) {
                console.error('Task not found in source section');
                loadBoards();
                return;
            }
            
            const oldIndex = sourceSection.taskIds.indexOf(taskId);
            
            // Make the server request using the move endpoint
            await handleTaskMove(taskId, sourceSectionId, targetSectionId, newIndex);
        } else {
            // Moving to different section
            await handleTaskMove(taskId, sourceSectionId, targetSectionId, newIndex);
        }
    } catch (error) {
        console.error('Error handling drop:', error);
        loadBoards();
    }
}

// Rendering
function renderActiveBoard() {
    // Early validation of board existence
    if (!state.activeBoard || !state.boards) {
        console.warn('No active board or boards state available');
        if (elements.currentBoard) {
            elements.currentBoard.textContent = 'No Board Selected';
        }
        if (elements.columns) {
            elements.columns.innerHTML = '';
        }
        return;
    }

    const board = state.boards[state.activeBoard];
    if (!board) {
        console.warn('Active board not found in boards state');
        if (elements.currentBoard) {
            elements.currentBoard.textContent = 'Board Not Found';
        }
        if (elements.columns) {
            elements.columns.innerHTML = '';
        }
        return;
    }

    if (!elements.currentBoard || !elements.columns) {
        console.error('Required DOM elements not found');
        return;
    }

    // Update board name
    elements.currentBoard.textContent = board.name || 'Unnamed Board';
    elements.columns.innerHTML = '';

    // Ensure sectionOrder exists and is an array
    if (!board.sectionOrder || !Array.isArray(board.sectionOrder)) {
        console.warn(`Invalid or missing sectionOrder for board: ${board.id}`);
        board.sectionOrder = [];
    }
    
    // Render sections
    board.sectionOrder.forEach(sectionId => {
        if (!sectionId) {
            console.warn('Null or undefined section ID found in sectionOrder');
            return;
        }
        
        const section = state.sections?.[sectionId];
        if (!section) {
            console.warn(`Section ${sectionId} not found in state`);
            return;
        }

        const columnEl = renderColumn(section);
        if (columnEl) {
            elements.columns.appendChild(columnEl);
        }
    });

    // Add the "Add Column" button
    const addColumnBtn = document.createElement('button');
    addColumnBtn.className = 'add-column-btn';
    addColumnBtn.setAttribute('aria-label', 'Add new column');
    addColumnBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addColumnBtn.addEventListener('click', () => addColumn(board.id));
    elements.columns.appendChild(addColumnBtn);
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

    // Task form submission
    elements.taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = elements.taskForm.dataset.taskId;
        const sectionId = elements.taskForm.dataset.sectionId;
        const title = elements.taskTitle.value.trim();
        const description = elements.taskDescription.value.trim();

        if (!title) return;

        try {
            if (taskId) {
                // Update existing task
                const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description })
                });

                if (response.ok) {
                    const updatedTask = await response.json();
                    state.tasks[taskId] = updatedTask;
                }
            } else {
                // Create new task
                await addTask(sectionId, title, description);
            }

            hideTaskModal();
            renderActiveBoard();
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    });
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
        boardContainer: document.querySelector('.board-container'),
        deleteTaskBtn: document.querySelector('.btn-delete')
    };

    // Check required elements
    const requiredElements = [
        'themeToggle', 'boardMenu', 'boardMenuBtn', 'boardList', 
        'addBoardBtn', 'currentBoard', 'columns', 'boardContainer',
        'taskModal', 'taskForm', 'taskTitle', 'taskDescription'
    ];

    for (const key of requiredElements) {
        if (!elements[key]) {
            console.error(`Required element "${key}" not found`);
            return;
        }
    }
    
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
            }
        }
    }

    await loadBoardsWithRetry();
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

function makeEditable(element, onSave) {
    // Prevent text selection on double-click
    element.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });

    element.addEventListener('click', function(e) {
        if (e.target.closest('.task-move')) return; // Don't trigger edit on move button click
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // Don't trigger if already editing
        
        const text = this.innerHTML.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]*>/g, '').trim();
        const isDescription = this.classList.contains('task-description');
        const input = document.createElement(isDescription ? 'textarea' : 'input');
        
        input.value = text;
        input.className = 'inline-edit';
        input.style.width = isDescription ? '100%' : 'auto';
        
        // Add editing class to show background
        element.classList.add('editing');
        
        const saveEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== text) {
                const success = await onSave(newText);
                if (success) {
                    element.innerHTML = isDescription ? linkify(newText) : newText;
                    renderActiveBoard();
                } else {
                    element.innerHTML = isDescription ? linkify(text) : text;
                }
            } else {
                element.innerHTML = isDescription ? linkify(text) : text;
            }
            element.classList.remove('editing');
        };

        const cancelEdit = () => {
            element.innerHTML = isDescription ? linkify(text) : text;
            element.classList.remove('editing');
            input.removeEventListener('blur', saveEdit);
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (!isDescription && e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (isDescription && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });

        // Replace the content with the input
        element.textContent = '';
        element.appendChild(input);
        input.focus();
        if (!isDescription) {
            // For title, put cursor at end instead of selecting all
            input.setSelectionRange(input.value.length, input.value.length);
        } else {
            // For descriptions, put cursor at end
            input.setSelectionRange(input.value.length, input.value.length);
        }
    });
}

// Helper function to convert URLs in text to clickable links and include line breaks
function linkify(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text
    .replace(urlRegex, function(url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    })
    .replace(/\n/g, '<br>');
}

function getPrioritySymbol(priority) {
    switch (priority) {
        case 'urgent': return '!';
        case 'high': return '↑';
        case 'medium': return '⇈';
        case 'low': return '↓';
        default: return '⇈';
    }
}

function renderColumn(section) {
    if (!section) return null;

    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.sectionId = section.id;

    // Ensure taskIds exists and is an array
    const taskIds = Array.isArray(section.taskIds) ? section.taskIds : [];
    const taskCount = taskIds.length;

    columnEl.innerHTML = `
        <div class="column-header">
            <div class="column-count">${taskCount}</div>
            <h2 class="column-title">${section.name || 'Unnamed Section'}</h2>
        </div>
        <div class="tasks" data-section-id="${section.id}"></div>
        <button class="add-task-btn" aria-label="Add task">
            <svg viewBox="0 0 24 24" width="24" height="24">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        </button>
    `;

    const tasksContainer = columnEl.querySelector('.tasks');
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
    const addTaskBtn = columnEl.querySelector('.add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            showTaskModal({ sectionId: section.id });
        });
    }

    // Set up drag and drop
    if (tasksContainer) {
        tasksContainer.addEventListener('dragover', handleDragOver);
        tasksContainer.addEventListener('drop', handleDrop);
        tasksContainer.addEventListener('dragenter', (e) => {
            const column = e.target.closest('.column');
            if (column) {
                column.classList.add('drag-over');
            }
        });
        tasksContainer.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.column');
            if (column) {
                column.classList.remove('drag-over');
            }
        });
    }

    return columnEl;
}

function renderTask(task) {
    if (!task) return null;

    const taskElement = document.createElement('div');
    taskElement.className = 'task';
    taskElement.dataset.taskId = task.id;
    taskElement.draggable = true;

    // Create task header with title
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    
    const taskTitle = document.createElement('h3');
    taskTitle.className = 'task-title';
    taskTitle.textContent = task.title || 'Untitled Task';
    taskHeader.appendChild(taskTitle);

    // Add metadata badges to header if they exist
    const metadataBadges = document.createElement('div');
    metadataBadges.className = 'task-badges';

    if (task.priority) {
        const priorityBadge = document.createElement('span');
        priorityBadge.className = `badge priority-badge ${task.priority}`;
        priorityBadge.setAttribute('title', task.priority.charAt(0).toUpperCase() + task.priority.slice(1));
        priorityBadge.textContent = getPrioritySymbol(task.priority);
        metadataBadges.appendChild(priorityBadge);
    }

    if (task.assignee) {
        const assigneeBadge = document.createElement('span');
        assigneeBadge.className = 'badge assignee-badge';
        assigneeBadge.textContent = task.assignee;
        metadataBadges.appendChild(assigneeBadge);
    }

    taskHeader.appendChild(metadataBadges);
    taskElement.appendChild(taskHeader);

    // Create task content for description and tags
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    // Add description if it exists
    if (task.description) {
        const taskDescription = document.createElement('div');
        taskDescription.className = 'task-description';
        taskDescription.innerHTML = linkify(task.description);
        taskContent.appendChild(taskDescription);
    }

    // Add tags if they exist
    if (Array.isArray(task.tags) && task.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'task-tags';
        
        task.tags.forEach(tag => {
            if (tag) {
                const tagBadge = document.createElement('span');
                tagBadge.className = 'badge tag-badge';
                tagBadge.textContent = tag;
                tagsContainer.appendChild(tagBadge);
            }
        });
        
        taskContent.appendChild(tagsContainer);
    }

    taskElement.appendChild(taskContent);

    // Set up drag events
    taskElement.addEventListener('dragstart', (e) => {
        taskElement.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: task.id,
            sourceSectionId: task.sectionId
        }));
    });

    taskElement.addEventListener('dragend', () => {
        taskElement.classList.remove('dragging');
    });

    // Double click to edit
    taskElement.addEventListener('dblclick', () => {
        showTaskModal(task);
    });

    return taskElement;
}

// Add the deleteTask function
async function deleteTask(taskId, sectionId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            // Remove task from state
            delete state.tasks[taskId];
            
            // Remove task from section's taskIds
            const section = state.sections[sectionId];
            if (section) {
                const taskIndex = section.taskIds.indexOf(taskId);
                if (taskIndex !== -1) {
                    section.taskIds.splice(taskIndex, 1);
                }
            }
            
            // Close modal and refresh board
            hideTaskModal();
            renderActiveBoard();
        } else {
            console.error('Failed to delete task:', response.statusText);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}