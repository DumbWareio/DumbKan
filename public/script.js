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
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
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
        const response = await fetch('/api/boards');
        const data = await response.json();
        state.boards = data.boards;
        state.activeBoard = data.activeBoard;
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
        const response = await fetch('/api/boards/active', {
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
        const response = await fetch('/api/boards', {
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
        const response = await fetch(`/api/boards/${state.activeBoard}/columns`, {
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
                titleElement.click();  // Trigger the makeEditable click handler
            }
        }
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

// Task Management
function showTaskModal(columnId) {
    elements.taskModal.hidden = false;
    elements.taskForm.dataset.columnId = columnId;
    elements.taskTitle.focus();
}

function hideTaskModal() {
    elements.taskModal.hidden = true;
    elements.taskForm.reset();
}

async function addTask(columnId, title, description = '') {
    try {
        const response = await fetch(`/api/boards/${state.activeBoard}/columns/${columnId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        const data = await response.json();
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
        const response = await fetch(`/api/boards/${state.activeBoard}/tasks/${taskId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromColumnId,
                toColumnId
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
    // Store both the task ID and its original column ID
    e.dataTransfer.setData('text/plain', JSON.stringify({
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
            const response = await fetch(`/api/boards/${state.activeBoard}/columns/${sourceColumnId}/tasks/reorder`, {
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

    // Task form and modal
    elements.taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = elements.taskTitle.value.trim();
        const description = elements.taskDescription.value.trim();
        const taskId = e.target.dataset.taskId;
        const columnId = e.target.dataset.columnId;
        
        if (title && columnId) {
            if (taskId) {
                // Edit existing task
                await updateTask(columnId, taskId, title, description);
            } else {
                // Add new task
                await addTask(columnId, title, description);
            }
            hideTaskModal();
        }
    });

    // Task modal event listeners
    if (elements.taskModal) {
        // Close modal with close button
        const closeButton = elements.taskModal.querySelector('.modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', hideTaskModal);
        }

        // Close modal with cancel button
        const cancelButton = elements.taskModal.querySelector('[data-action="cancel"]');
        if (cancelButton) {
            cancelButton.addEventListener('click', hideTaskModal);
        }

        // Delete button
        const deleteButton = elements.taskModal.querySelector('[data-action="delete"]');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                const taskId = elements.taskForm.dataset.taskId;
                const columnId = elements.taskForm.dataset.columnId;
                const taskTitle = elements.taskTitle.value;
                if (taskId && columnId) {
                    hideTaskModal();
                    showConfirmModal(taskId, taskTitle, 'task', columnId);
                }
            });
        }

        // Close modal when clicking outside
        elements.taskModal.addEventListener('click', (e) => {
            if (e.target === elements.taskModal) {
                hideTaskModal();
            }
        });

        // Prevent modal close when clicking inside modal content
        const modalContent = elements.taskModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.taskModal.hidden) {
            hideTaskModal();
        }
    });

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
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription')
    };

    // Add confirm modal elements separately
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        elements.confirmModal = confirmModal;
        elements.confirmModalMessage = confirmModal.querySelector('p');
        elements.confirmModalConfirmBtn = confirmModal.querySelector('[data-action="confirm"]');
    }

    // Check required elements
    const requiredElements = [
        'themeToggle', 'boardMenu', 'boardMenuBtn', 'boardList', 
        'addBoardBtn', 'currentBoard', 'addColumnBtn', 'columns',
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

function initLogin() {
    // Initialize theme on login page
    initTheme();
    const themeToggleElem = document.getElementById('themeToggle');
    if (themeToggleElem) {
        themeToggleElem.addEventListener('click', toggleTheme);
    }
    
    // For the login page, only fetch the PIN length and generate the input boxes
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
                      // Redirect to the index page using the base URL
                      window.location.href = window.appConfig.basePath + '/';
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
        if (e.target.tagName === 'INPUT') return; // Don't trigger if already editing
        
        const text = this.textContent.trim();
        const input = document.createElement('input');
        input.value = text;
        input.className = 'inline-edit';
        input.style.width = '100%';
        input.style.height = '100%';
        
        const saveEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== text) {
                const success = await onSave(newText);
                if (success) {
                    element.textContent = newText;
                    // Re-render the board to ensure all state changes are reflected
                    renderActiveBoard();
                } else {
                    element.textContent = text;
                }
            } else {
                element.textContent = text;
            }
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                element.textContent = text;
                input.removeEventListener('blur', saveEdit);
            }
        });

        // Replace the content with the input
        element.textContent = '';
        element.appendChild(input);
        input.focus();
        input.select();
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
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmModal(task.id, task.title, 'task', task.columnId);
    });
    taskElement.appendChild(deleteBtn);
    
    // Add double-click handler with move button check
    taskElement.addEventListener('dblclick', (e) => {
        // Don't trigger edit modal if clicking the move button
        if (e.target.closest('.task-move')) return;
        showEditTaskModal(task);
    });
    
    // Add drag event listeners
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
    
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const taskTitle = document.createElement('div');
    taskTitle.className = 'task-title';
    taskTitle.textContent = task.title;

    const taskDescription = document.createElement('div');
    taskDescription.className = 'task-description';
    // Only show first line in the card, converting URLs to clickable links
    taskDescription.innerHTML = linkify((task.description || '').split('\n')[0]);

    makeEditable(taskTitle, async (newTitle) => {
        try {
            const response = await fetch(`/api/boards/${state.activeBoard}/columns/${task.columnId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, description: task.description })
            });
        
        if (response.ok) {
                // Update local state
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

    makeEditable(taskDescription, async (newDescription) => {
        try {
            const response = await fetch(`/api/boards/${state.activeBoard}/columns/${task.columnId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: task.title, description: newDescription })
            });
            
            if (response.ok) {
                // Update local state
                const taskObj = state.boards[state.activeBoard].columns[task.columnId].tasks.find(t => t.id === task.id);
                if (taskObj) {
                    taskObj.description = newDescription;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task:', error);
            return false;
        }
    });

    // Add double-click handler to show full description in modal
    taskDescription.addEventListener('dblclick', (e) => {
        if (e.target.closest('.task-move')) return;
        showEditTaskModal(task);
    });

    taskContent.appendChild(taskTitle);
    taskContent.appendChild(taskDescription);
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
                const response = await fetch(`/api/boards/${state.activeBoard}/tasks/${task.id}/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromColumnId: task.columnId,
                        toColumnId: nextColumnId
                    })
                });

                if (response.ok) {
                    // Update local state
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

    return taskElement;
}

function renderColumn(column, columnId) {
    // Add the id to the column object
    return createColumnElement({...column, id: columnId});
}

function createColumnElement(column) {
    const columnElement = document.createElement('div');
    columnElement.className = 'column';
    columnElement.dataset.columnId = column.id;

    const header = document.createElement('div');
    header.className = 'column-header';
    header.draggable = true;
    
    // Add drag event listeners to header
    header.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        columnElement.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            columnId: column.id,
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
            const response = await fetch(`/api/boards/${state.activeBoard}/columns/${column.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                state.boards[state.activeBoard].columns[column.id].name = newName;
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
            columnId: column.id
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
        showAddTaskModal(column.id);
    });

    tasksContainer.appendChild(addTaskButton);
    
    columnElement.appendChild(tasksContainer);
    
    // Add column drag and drop event listeners
    columnElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingColumn = document.querySelector('.column.dragging');
        if (!draggingColumn || draggingColumn === columnElement) return;
        
        const columns = [...document.querySelectorAll('.column')];
        const draggedIndex = columns.indexOf(draggingColumn);
        const dropIndex = columns.indexOf(columnElement);
        
        if (draggedIndex < dropIndex) {
            columnElement.parentNode.insertBefore(draggingColumn, columnElement.nextSibling);
        } else {
            columnElement.parentNode.insertBefore(draggingColumn, columnElement);
        }
    });
    
    columnElement.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (document.querySelector('.column.dragging')) {
            columnElement.classList.add('column-drag-over');
        }
    });
    
    columnElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!columnElement.contains(e.relatedTarget)) {
            columnElement.classList.remove('column-drag-over');
        }
    });
    
    columnElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        columnElement.classList.remove('column-drag-over');
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type !== 'column') return;
            
            const columns = [...document.querySelectorAll('.column')];
            const newOrder = columns.map(col => col.dataset.columnId);
            
            // Make the server request to update column order
            const response = await fetch(`/api/boards/${state.activeBoard}/columns/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    columnOrder: newOrder
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to reorder columns');
            }
            
            // Update local state to match the new order
            const newColumns = {};
            newOrder.forEach(columnId => {
                newColumns[columnId] = state.boards[state.activeBoard].columns[columnId];
            });
            state.boards[state.activeBoard].columns = newColumns;
            
        } catch (error) {
            console.error('Error reordering columns:', error);
            renderActiveBoard(); // Revert to previous state
        }
    });

    return columnElement;
}

async function deleteColumn(columnId) {
    try {
        const response = await fetch(`/api/boards/${state.activeBoard}/columns/${columnId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Update local state
            delete state.boards[state.activeBoard].columns[columnId];
            renderActiveBoard();
        }
    } catch (error) {
        console.error('Failed to delete column:', error);
    }
}

function showConfirmModal(id, name, type = 'column', columnId = null) {
    if (!elements.confirmModal || !elements.confirmModalMessage || !elements.confirmModalConfirmBtn) {
        console.error('Required modal elements not found');
        return;
    }

    // Update modal title based on type
    const modalTitle = elements.confirmModal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = type === 'column' ? 'Delete Column' : 'Delete Task';
    }

    const message = type === 'column' 
        ? `Are you sure you want to delete the column "${name}"? This action cannot be undone.`
        : `Are you sure you want to delete the task "${name}"? This action cannot be undone.`;

    elements.confirmModalMessage.textContent = message;
    elements.confirmModal.hidden = false;
    
    // Remove any existing event listeners
    const newConfirmBtn = elements.confirmModalConfirmBtn.cloneNode(true);
    elements.confirmModalConfirmBtn.parentNode.replaceChild(newConfirmBtn, elements.confirmModalConfirmBtn);
    elements.confirmModalConfirmBtn = newConfirmBtn;
    
    // Add new event listener
    elements.confirmModalConfirmBtn.addEventListener('click', async () => {
        if (type === 'column') {
            await deleteColumn(id);
        } else {
            await deleteTask(columnId, id);
        }
        hideConfirmModal();
    });
}

function hideConfirmModal() {
    if (elements.confirmModal) {
        elements.confirmModal.hidden = true;
    }
}

// Add these new functions for task modal handling
function showEditTaskModal(task) {
    elements.taskModal.querySelector('h2').textContent = 'Edit Task';
    elements.taskTitle.value = task.title;
    elements.taskDescription.value = task.description || '';
    elements.taskForm.dataset.taskId = task.id;
    elements.taskForm.dataset.columnId = task.columnId;
    elements.taskModal.removeAttribute('hidden');
    elements.taskTitle.focus();
    
    // Show delete button only in edit mode
    const deleteButton = elements.taskModal.querySelector('[data-action="delete"]');
    if (deleteButton) {
        deleteButton.style.display = 'block';
    }
}

function showAddTaskModal(columnId) {
    elements.taskModal.querySelector('h2').textContent = 'Add New Task';
    elements.taskTitle.value = '';
    elements.taskDescription.value = '';
    elements.taskForm.dataset.taskId = '';
    elements.taskForm.dataset.columnId = columnId;
    elements.taskModal.removeAttribute('hidden');
    elements.taskTitle.focus();
    
    // Hide delete button in add mode
    const deleteButton = elements.taskModal.querySelector('[data-action="delete"]');
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }
    
    // Change submit button text to "Add Task"
    const submitButton = elements.taskForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'Add Task';
    }
}

// Add this new function for updating tasks
async function updateTask(columnId, taskId, title, description) {
    try {
        const response = await fetch(`/api/boards/${state.activeBoard}/columns/${columnId}/tasks/${taskId}`, {
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
}

// Add this new function for deleting tasks
async function deleteTask(columnId, taskId) {
    try {
        const response = await fetch(`/api/boards/${state.activeBoard}/columns/${columnId}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Update local state
            const column = state.boards[state.activeBoard].columns[columnId];
            column.tasks = column.tasks.filter(task => task.id !== taskId);
            renderActiveBoard();
        }
    } catch (error) {
        console.error('Failed to delete task:', error);
    }
}