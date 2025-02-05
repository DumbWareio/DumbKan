// State Management
let state = {
    boards: {},
    activeBoard: null,
    currentColumnId: null
};

// DOM Elements placeholder
let elements = {};

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        // Use saved theme if available
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Check system preference
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
        const response = await fetch(window.appConfig.basePath + '/api/boards');
        const data = await response.json();
        state.boards = data.boards;
        
        // If no active board is set, use the first available board
        if (!data.activeBoard && Object.keys(data.boards).length > 0) {
            state.activeBoard = Object.keys(data.boards)[0];
        } else {
            state.activeBoard = data.activeBoard;
        }
        
        renderBoards();
        renderActiveBoard();
    } catch (error) {
        console.error('Failed to load boards:', error);
    }
}

function renderBoards() {
    elements.boardList.innerHTML = '';
    Object.entries(state.boards).forEach(([id, board]) => {
        const li = document.createElement('li');
        li.textContent = board.name;
        li.dataset.boardId = id;
        if (id === state.activeBoard) li.classList.add('active');
        li.addEventListener('click', () => switchBoard(id));
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
            renderBoards();
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
        const data = await response.json();
        state.boards[data.id] = data;
        renderBoards();
    } catch (error) {
        console.error('Failed to create board:', error);
    }
}

// Column Management
async function addColumn(name = '') {
    try {
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || 'New Column' })
        });
        const data = await response.json();
        state.boards[state.activeBoard].columns[data.id] = data;
        await renderActiveBoard();
        
        // Focus the new column's title
        const newColumn = document.querySelector(`[data-column-id="${data.id}"]`);
        if (newColumn) {
            const titleElement = newColumn.querySelector('.column-title');
            if (titleElement) {
                titleElement.click();
            }
        }
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

// Task Management
function showTaskModal(task) {
    if (!elements.taskModal) return;
    
    elements.taskModal.querySelector('h2').textContent = 'Edit Task';
    elements.taskTitle.value = task.title;
    elements.taskDescription.value = task.description || '';
    elements.taskForm.dataset.taskId = task.id;
    elements.taskForm.dataset.columnId = task.columnId;
    elements.taskModal.hidden = false;
    elements.taskTitle.focus();
}

function hideTaskModal() {
    if (!elements.taskModal) return;
    elements.taskModal.hidden = true;
    elements.taskForm.reset();
    delete elements.taskForm.dataset.taskId;
    delete elements.taskForm.dataset.columnId;
}

async function addTask(columnId, title, description = '') {
    try {
        if (!columnId) {
            console.error('Column ID is required to add a task');
            return;
        }
        
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${columnId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to add task: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Make sure the column exists in state before trying to access it
        if (!state.boards[state.activeBoard].columns[columnId]) {
            console.error('Column not found in state:', columnId);
            return;
        }
        
        state.boards[state.activeBoard].columns[columnId].tasks.push(data);
        renderActiveBoard();
    } catch (error) {
        console.error('Failed to add task:', error);
    }
}

// Drag and Drop
async function handleTaskMove(taskId, fromColumnId, toColumnId, newIndex) {
    try {
        console.log(`Attempting to move task ${taskId} from column ${fromColumnId} to column ${toColumnId} at index ${newIndex}`);
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/tasks/${taskId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromColumnId,
                toColumnId,
                newIndex
            })
        });

        if (!response.ok) {
            throw new Error('Failed to move task');
        }

        // Update local state
        const sourceColumn = state.boards[state.activeBoard].columns[fromColumnId];
        const targetColumn = state.boards[state.activeBoard].columns[toColumnId];
        
        // Find and remove task from source column
        const taskIndex = sourceColumn.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            console.error(`Task ${taskId} not found in source column ${fromColumnId}`);
            throw new Error('Task not found in source column');
        }
        
        const [task] = sourceColumn.tasks.splice(taskIndex, 1);
        console.log(`Task ${taskId} found and removed from source column ${fromColumnId}`);
        // Update the task's column ID
        task.columnId = toColumnId;
        
        // Add to target column at specific index
        targetColumn.tasks.splice(newIndex, 0, task);
        console.log(`Task ${taskId} added to target column ${toColumnId} at index ${newIndex}`);
        
        renderActiveBoard();
    } catch (error) {
        console.error('Failed to move task:', error);
        loadBoards(); // Revert to server state on error
    }
}

function handleDragStart(e) {
    const task = e.target.closest('.task');
    if (!task) return;
    
    task.classList.add('dragging');
    // Store both the task ID and its original column ID using application/json
    e.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.dataset.taskId,
        sourceColumnId: task.closest('.column').dataset.columnId
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
        const { taskId, sourceColumnId } = data;
        
        const task = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!task) return;
        
        const targetColumnId = column.dataset.columnId;
        
        console.log(`Moving task ${taskId} from column ${sourceColumnId} to column ${targetColumnId}`);
        
        // Check if we have access to the required state
        if (!state.boards?.[state.activeBoard]?.columns) {
            console.error('Invalid board state');
            return;
        }

        const sourceColumn = state.boards[state.activeBoard].columns[sourceColumnId];
        const targetColumn = state.boards[state.activeBoard].columns[targetColumnId];

        if (!sourceColumn?.tasks || !targetColumn?.tasks) {
            console.error('Invalid column state');
            return;
        }

        const tasksContainer = column.querySelector('.tasks');
        const siblings = [...tasksContainer.querySelectorAll('.task')];
        const newIndex = siblings.indexOf(task);
        
        if (sourceColumnId === targetColumnId) {
            // Same column reordering
            const taskObj = sourceColumn.tasks.find(t => t.id === taskId);
            if (!taskObj) {
                console.error('Task not found in source column');
                loadBoards();
                return;
            }
            
            const oldIndex = sourceColumn.tasks.indexOf(taskObj);
            
            // Make the server request
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${sourceColumnId}/tasks/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskId,
                    newIndex
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to reorder task');
            }

            // Update local state
            sourceColumn.tasks.splice(oldIndex, 1);
            sourceColumn.tasks.splice(newIndex, 0, taskObj);
            renderActiveBoard();
        } else {
            // Moving to different column
            await handleTaskMove(taskId, sourceColumnId, targetColumnId, newIndex);
        }
    } catch (error) {
        console.error('Error handling drop:', error);
        loadBoards();
    }
}

// Rendering
function renderActiveBoard() {
    const board = state.boards[state.activeBoard];
    if (!board) return;

    elements.currentBoard.textContent = board.name;
    elements.columns.innerHTML = '';

    // Convert columns to array to find next column easily
    const columnEntries = Object.entries(board.columns);

    columnEntries.forEach(([columnId, column]) => {
        const columnEl = renderColumn(column, columnId);
        elements.columns.appendChild(columnEl);
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
    addColumnBtn.addEventListener('click', () => addColumn());
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

    // Add column button
    elements.addColumnBtn.addEventListener('click', () => addColumn());

    // Confirm modal event listeners
    if (elements.confirmModal) {
        // Close button
        const confirmModalClose = elements.confirmModal.querySelector('.modal-close');
        if (confirmModalClose) {
            confirmModalClose.addEventListener('click', hideConfirmModal);
        }

        // Cancel button
        const confirmModalCancel = elements.confirmModal.querySelector('[data-action="cancel"]');
        if (confirmModalCancel) {
            confirmModalCancel.addEventListener('click', hideConfirmModal);
        }

        // Close when clicking outside
        elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === elements.confirmModal) {
                hideConfirmModal();
            }
        });

        // Prevent close when clicking inside modal content
        const confirmModalContent = elements.confirmModal.querySelector('.modal-content');
        if (confirmModalContent) {
            confirmModalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // Task modal event listeners
    if (elements.taskModal) {
        // Close button
        const taskModalClose = elements.taskModal.querySelector('.modal-close');
        if (taskModalClose) {
            taskModalClose.addEventListener('click', hideTaskModal);
        }

        // Close when clicking outside
        elements.taskModal.addEventListener('click', (e) => {
            if (e.target === elements.taskModal) {
                hideTaskModal();
            }
        });

        // Handle Ctrl+Enter (or Cmd+Enter on Mac) to save
        elements.taskModal.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const submitButton = elements.taskForm.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.click();
                }
            }
        });

        // Form submission
        elements.taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = elements.taskForm.dataset.taskId;
            const columnId = elements.taskForm.dataset.columnId;
            const title = elements.taskTitle.value.trim();
            const description = elements.taskDescription.value.trim();

            try {
                const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${columnId}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description })
                });
                
                if (response.ok) {
                    const taskObj = state.boards[state.activeBoard].columns[columnId].tasks.find(t => t.id === taskId);
                    if (taskObj) {
                        taskObj.title = title;
                        taskObj.description = description;
                        renderActiveBoard();
                    }
                }
            } catch (error) {
                console.error('Failed to update task:', error);
            }
            
            hideTaskModal();
        });

        // Delete button
        const deleteButton = elements.taskModal.querySelector('[data-action="delete"]');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                const taskId = elements.taskForm.dataset.taskId;
                const columnId = elements.taskForm.dataset.columnId;
                const taskTitle = elements.taskTitle.value;
                hideTaskModal();
                showConfirmModal(taskId, taskTitle, 'task', columnId);
            });
        }
    }
}

// Initialization
async function initBoard() {
    // Initialize elements after DOM is loaded
    elements = {
        themeToggle: document.getElementById('themeToggle'),
        boardMenu: document.getElementById('boardMenu'),
        boardMenuBtn: document.getElementById('boardMenuBtn'),
        boardList: document.getElementById('boardList'),
        addBoardBtn: document.getElementById('addBoardBtn'),
        currentBoard: document.getElementById('currentBoard'),
        addColumnBtn: document.getElementById('addColumnBtn'),
        columns: document.getElementById('columns'),
        confirmModal: document.getElementById('confirmModal'),
        confirmModalMessage: document.querySelector('#confirmModal p'),
        confirmModalConfirmBtn: document.querySelector('#confirmModal [data-action="confirm"]'),
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription')
    };

    // Check required elements
    const requiredElements = [
        'themeToggle', 'boardMenu', 'boardMenuBtn', 'boardList', 
        'addBoardBtn', 'currentBoard', 'addColumnBtn', 'columns',
        'confirmModal', 'confirmModalMessage', 'confirmModalConfirmBtn',
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
    await loadBoards();
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
        initBoard();
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

function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.columnId = task.columnId;
    taskElement.draggable = true;
    
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const taskTitle = document.createElement('div');
    taskTitle.className = 'task-title';
    taskTitle.textContent = task.title;

    // Add drag event listeners to the task element
    taskElement.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        taskElement.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: task.id,
            sourceColumnId: task.columnId
        }));
        e.dataTransfer.effectAllowed = 'move';
    });
    
    taskElement.addEventListener('dragend', (e) => {
        e.stopPropagation();
        taskElement.classList.remove('dragging');
        document.querySelectorAll('.column').forEach(col => {
            col.classList.remove('drag-over');
        });
    });

    makeEditable(taskTitle, async (newTitle) => {
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${task.columnId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, description: task.description })
            });
        
            if (response.ok) {
                const taskObj = state.boards[state.activeBoard].columns[task.columnId].tasks.find(t => t.id === task.id);
                if (taskObj) {
                    taskObj.title = newTitle;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task:', error);
            return false;
        }
    });

    // Create description section
    const descriptionId = 'desc-' + task.id;
    const descriptionSection = document.createElement('div');
    descriptionSection.className = 'description-section';
    
    if (task.description) {
        // If there's a description, show it with edit capability
        const taskDescription = document.createElement('div');
        taskDescription.className = 'task-description has-description';
        taskDescription.innerHTML = linkify(task.description);
        
        makeEditable(taskDescription, async (newDescription) => {
            try {
                const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${task.columnId}/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: task.title, description: newDescription })
                });
                
                if (response.ok) {
                    const taskObj = state.boards[state.activeBoard].columns[task.columnId].tasks.find(t => t.id === task.id);
                    if (taskObj) {
                        taskObj.description = newDescription;
                    }
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to update task description:', error);
                return false;
            }
        });
        
        descriptionSection.appendChild(taskDescription);
    } else {
        // If no description, show the add description button
        const showLink = document.createElement('button');
        showLink.className = 'show-description';
        showLink.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        const hideLink = document.createElement('button');
        hideLink.className = 'hide-description';
        hideLink.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <polyline points="18 15 12 9 6 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        const descriptionContent = document.createElement('div');
        descriptionContent.className = 'description-content';
        
        const descriptionInput = document.createElement('textarea');
        descriptionInput.className = 'inline-edit';
        descriptionInput.placeholder = 'Add a description...';
        
        // Show/hide description content with JavaScript
        showLink.addEventListener('click', (e) => {
            e.preventDefault();
            descriptionContent.style.display = 'block';
            showLink.style.display = 'none';
            hideLink.style.display = 'flex';
            setTimeout(() => {
                descriptionInput.focus();
            }, 0);
        });
        
        hideLink.addEventListener('click', (e) => {
            e.preventDefault();
            descriptionContent.style.display = 'none';
            showLink.style.display = 'flex';
            hideLink.style.display = 'none';
        });

        descriptionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                descriptionInput.blur();
            }
        });
        
        descriptionInput.addEventListener('blur', async () => {
            const newDescription = descriptionInput.value.trim();
            if (newDescription) {
                try {
                    const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${task.columnId}/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: task.title, description: newDescription })
                    });
                    
                    if (response.ok) {
                        const taskObj = state.boards[state.activeBoard].columns[task.columnId].tasks.find(t => t.id === task.id);
                        if (taskObj) {
                            taskObj.description = newDescription;
                        }
                        renderActiveBoard();
                    }
                } catch (error) {
                    console.error('Failed to update task description:', error);
                }
            }
        });

        descriptionContent.appendChild(descriptionInput);
        descriptionSection.appendChild(showLink);
        descriptionSection.appendChild(hideLink);
        descriptionSection.appendChild(descriptionContent);
    }

    taskContent.appendChild(taskTitle);
    taskContent.appendChild(descriptionSection);
    taskElement.appendChild(taskContent);

    // Add move button if not the last column
    const columns = Object.keys(state.boards[state.activeBoard].columns);
    const currentColumnIndex = columns.indexOf(task.columnId);
    if (currentColumnIndex < columns.length - 1) {
        const moveButton = document.createElement('button');
        moveButton.className = 'task-move';
        moveButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"></path></svg>';
        moveButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nextColumnId = columns[currentColumnIndex + 1];
            try {
                const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/tasks/${task.id}/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromColumnId: task.columnId,
                        toColumnId: nextColumnId
                    })
                });

                if (response.ok) {
                    const taskIndex = state.boards[state.activeBoard].columns[task.columnId].tasks.findIndex(t => t.id === task.id);
                    const [movedTask] = state.boards[state.activeBoard].columns[task.columnId].tasks.splice(taskIndex, 1);
                    state.boards[state.activeBoard].columns[nextColumnId].tasks.push(movedTask);
                    renderActiveBoard();
                }
            } catch (error) {
                console.error('Failed to move task:', error);
            }
        });
        taskElement.appendChild(moveButton);
    }

    taskElement.addEventListener('dblclick', (e) => {
        // Don't trigger if clicking on an input or the move button
        if (e.target.closest('input, textarea, .task-move, .show-description, .hide-description')) return;
        showTaskModal({
            id: task.id,
            title: task.title,
            description: task.description,
            columnId: task.columnId
        });
    });

    return taskElement;
}

function renderColumn(column, columnId) {
    const columnElement = document.createElement('div');
    columnElement.className = 'column';
    columnElement.dataset.columnId = columnId;

    const header = document.createElement('div');
    header.className = 'column-header';
    header.draggable = true;
    
    // Add drag event listeners to header
    header.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        columnElement.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            columnId: columnId,
            type: 'column'
        }));
    });
    
    header.addEventListener('dragend', (e) => {
        e.stopPropagation();
        columnElement.classList.remove('dragging');
        document.querySelectorAll('.column').forEach(col => {
            col.classList.remove('column-drag-over');
        });
    });

    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = column.tasks.length;

    const title = document.createElement('div');
    title.className = 'column-title';
    title.textContent = column.name;

    makeEditable(title, async (newName) => {
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${columnId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                state.boards[state.activeBoard].columns[columnId].name = newName;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update column:', error);
            return false;
        }
    });

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'column-delete';
    deleteBtn.setAttribute('aria-label', 'Delete column');
    deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmModal(column.id, column.name);
    });

    header.appendChild(count);
    header.appendChild(title);
    columnElement.appendChild(deleteBtn);
    columnElement.appendChild(header);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'tasks';
    
    // Add drag and drop event listeners for tasks
    tasksContainer.addEventListener('dragover', handleDragOver);
    tasksContainer.addEventListener('drop', handleDrop);
    tasksContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        const column = e.target.closest('.column');
        if (column) {
            column.classList.add('drag-over');
        }
    });
    tasksContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        const column = e.target.closest('.column');
        if (column && !column.contains(e.relatedTarget)) {
            column.classList.remove('drag-over');
        }
    });
    
    column.tasks.forEach(task => {
        const taskEl = createTaskElement({
            ...task,
            columnId: columnId
        });
        tasksContainer.appendChild(taskEl);
    });
    
    const addTaskButton = document.createElement('button');
    addTaskButton.className = 'add-task-btn';
    addTaskButton.setAttribute('aria-label', 'Add new task');
    addTaskButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addTaskButton.addEventListener('click', () => {
        const tasksContainer = columnElement.querySelector('.tasks');
        const newTask = createEmptyTaskElement(columnId);
        tasksContainer.insertBefore(newTask, addTaskButton);
        const input = newTask.querySelector('input');
        if (input) {
            input.focus();
            input.select();
        }
    });

    tasksContainer.appendChild(addTaskButton);
    columnElement.appendChild(tasksContainer);
    
    // Add column drag and drop event listeners
    columnElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const draggingColumn = document.querySelector('.column.dragging');
        if (!draggingColumn) return;
        
        const columns = [...document.querySelectorAll('.column:not(.dragging)')];
        const nextColumn = columns.find(column => {
            const rect = column.getBoundingClientRect();
            return e.clientX < rect.left + rect.width / 2;
        });
        
        if (nextColumn) {
            elements.columns.insertBefore(draggingColumn, nextColumn);
        } else {
            elements.columns.appendChild(draggingColumn);
        }
    });

    columnElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        // Get the new order of columns after the drop
        const columns = [...document.querySelectorAll('.column')];
        const newOrder = columns.map(col => col.dataset.columnId).filter(id => id);
        
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    columnOrder: newOrder
                })
            });
            
            if (response.ok) {
                // Update local state by reordering the columns
                const reorderedColumns = {};
                newOrder.forEach(columnId => {
                    if (state.boards[state.activeBoard].columns[columnId]) {
                        reorderedColumns[columnId] = state.boards[state.activeBoard].columns[columnId];
                    }
                });
                state.boards[state.activeBoard].columns = reorderedColumns;
                renderActiveBoard();
            } else {
                console.error('Failed to reorder columns:', response.status);
                renderActiveBoard(); // Revert to previous state
            }
        } catch (error) {
            console.error('Failed to reorder columns:', error);
            renderActiveBoard(); // Revert to previous state
        }
    });

    return columnElement;
}

// Add drag event listeners to the task element
function addTaskDragListeners(taskElement) {
    taskElement.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        taskElement.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: taskElement.dataset.taskId,
            sourceColumnId: taskElement.dataset.columnId
        }));
        e.dataTransfer.effectAllowed = 'move';
    });
    
    taskElement.addEventListener('dragend', (e) => {
        e.stopPropagation();
        taskElement.classList.remove('dragging');
        document.querySelectorAll('.column').forEach(col => {
            col.classList.remove('drag-over');
        });
    });
}

// Add these functions for modal handling
function hideConfirmModal() {
    if (elements.confirmModal) {
        elements.confirmModal.hidden = true;
    }
}

function showConfirmModal(id, name, type = 'column', columnId = null) {
    // First validate that all required modal elements exist
    const modalElements = {
        modal: elements.confirmModal,
        message: elements.confirmModalMessage,
        confirmBtn: elements.confirmModalConfirmBtn,
        title: elements.confirmModal?.querySelector('h2')
    };

    // Check if any required elements are missing
    const missingElements = Object.entries(modalElements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

    if (missingElements.length > 0) {
        console.error(`Required modal elements missing: ${missingElements.join(', ')}`);
        return false;
    }

    // Update modal title based on type
    if (modalElements.title) {
        modalElements.title.textContent = type === 'column' ? 'Delete Column' : 'Delete Task';
    }

    const message = type === 'column' 
        ? `Are you sure you want to delete the column "${name}"? This action cannot be undone.`
        : `Are you sure you want to delete the task "${name}"? This action cannot be undone.`;

    modalElements.message.textContent = message;
    modalElements.modal.hidden = false;
    
    // Remove any existing event listeners
    const newConfirmBtn = modalElements.confirmBtn.cloneNode(true);
    modalElements.confirmBtn.parentNode.replaceChild(newConfirmBtn, modalElements.confirmBtn);
    elements.confirmModalConfirmBtn = newConfirmBtn;
    
    // Add new event listener with corrected parameter passing
    elements.confirmModalConfirmBtn.addEventListener('click', async () => {
        try {
            if (type === 'column') {
                // For columns, 'id' is the columnId
                await deleteColumn(id);
            } else {
                // For tasks, 'id' is the taskId and we use the provided columnId
                await deleteTask(columnId, id);
            }
            hideConfirmModal();
        } catch (error) {
            console.error(`Failed to delete ${type}:`, error);
            // Optionally show an error message to the user here
        }
    });

    return true;
}

async function deleteColumn(columnId) {
    try {
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${columnId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            delete state.boards[state.activeBoard].columns[columnId];
            renderActiveBoard();
        }
    } catch (error) {
        console.error('Failed to delete column:', error);
    }
}

async function deleteTask(columnId, taskId) {
    try {
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/columns/${columnId}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const column = state.boards[state.activeBoard].columns[columnId];
            column.tasks = column.tasks.filter(task => task.id !== taskId);
            renderActiveBoard();
        }
    } catch (error) {
        console.error('Failed to delete task:', error);
    }
}

function createEmptyTaskElement(columnId) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task';
    taskElement.draggable = false;
    taskElement.dataset.columnId = columnId;

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const taskTitle = document.createElement('div');
    taskTitle.className = 'task-title';
    
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.placeholder = 'Enter task title';
    
    const saveNewTask = async () => {
        const title = input.value.trim();
        if (title) {
            const actualColumnId = taskElement.dataset.columnId;
            if (!actualColumnId) {
                console.error('Column ID is missing');
                return;
            }
            await addTask(actualColumnId, title);
            renderActiveBoard();
        } else {
            taskElement.remove();
        }
    };

    input.addEventListener('blur', saveNewTask);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            taskElement.remove();
        }
    });

    taskTitle.appendChild(input);
    taskContent.appendChild(taskTitle);
    taskElement.appendChild(taskContent);

    return taskElement;
}