/**
 * UI utility functions
 * Provides common UI interaction utilities for the application
 * Handles things like editable fields, error messages, and UI helpers
 */

// Export utility functions individually instead of in a single object
// Each function will be individually exported with its declaration

/**
 * Initializes the credit visibility feature
 * Shows the credit footer when the user scrolls to the bottom of the page
 * Sets up event listeners for scroll and resize events
 */
export function initCreditVisibility() {
    // Handler function for scroll and resize events
    const handleCreditVisibility = () => {
        const credit = document.querySelector('.dumbware-credit');
        if (!credit) return;

        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
        credit.classList.toggle('visible', isAtBottom);
    };

    // Add event listeners
    window.addEventListener('scroll', handleCreditVisibility, { passive: true });
    window.addEventListener('resize', handleCreditVisibility, { passive: true });

    // Initial check to set correct visibility state
    handleCreditVisibility();

    return handleCreditVisibility;
}

/**
 * Makes an element editable with inline editing capabilities
 * @param {HTMLElement} element - The element to make editable
 * @param {Function} onSave - Callback function to handle saving changes
 * @param {Object} appState - The application state object containing tasks
 */
export function makeEditable(element, onSave, appState) {
    // Prevent text selection on double-click
    element.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });

    element.addEventListener('click', function(e) {
        if (e.target.closest('.task-move')) return; // Don't trigger edit on move button click
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // Don't trigger if already editing
        
        const isDescription = this.classList.contains('task-description');
        let text;
        if (isDescription) {
            // For descriptions, get the original markdown text from the task data
            const taskId = this.closest('.task').dataset.taskId;
            text = appState.tasks[taskId]?.description || '';
        } else {
            // For other elements, get the text content
            text = this.innerHTML.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]*>/g, '').trim();
        }
        
        const editContainer = document.createElement('div');
        editContainer.style.position = 'relative';
        editContainer.style.width = '100%';
        editContainer.style.display = 'flex';
        editContainer.style.alignItems = 'center';
        
        const input = document.createElement(isDescription ? 'textarea' : 'input');
        input.value = text;
        input.className = 'inline-edit';
        input.style.width = '100%';
        input.style.paddingRight = '30px';
        input.style.margin = '0';
        input.style.lineHeight = 'inherit';
        
        // Adjust height based on context
        if (element.closest('.task-title')) {
            input.style.height = '28px'; // Slightly taller for task titles
            editContainer.style.minHeight = '28px';
            input.style.padding = '4px 30px 4px 8px';
        } else {
            input.style.height = isDescription ? 'auto' : '24px';
            input.style.padding = '2px 30px 2px 8px';
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'inline-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.right = '8px';
        deleteBtn.style.top = '50%';
        deleteBtn.style.transform = 'translateY(-50%)';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.color = '#ff4444';
        deleteBtn.style.fontSize = '18px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.padding = '4px';
        deleteBtn.style.display = isDescription ? 'none' : 'block';
        deleteBtn.style.zIndex = '2';
        deleteBtn.style.lineHeight = '1';
        deleteBtn.style.height = '24px';
        
        let isConfirming = false;
        const itemType = element.closest('.task') ? 'task' : 
                        element.closest('.column-title') ? 'section' :
                        element.closest('li[data-board-id]') ? 'board' : 'board';
        
        deleteBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!isConfirming) {
                isConfirming = true;
                input.value = `Delete ${itemType}`;
                input.readOnly = true;
                deleteBtn.innerHTML = '✓';
                deleteBtn.style.color = '#4CAF50';
            } else {
                // Handle deletion based on type
                try {
                    let success = false;
                    if (itemType === 'task') {
                        const taskElement = element.closest('.task');
                        const taskId = taskElement.dataset.taskId;
                        const sectionId = taskElement.closest('.column').dataset.sectionId;
                        success = await deleteTask(taskId, sectionId);
                    } else if (itemType === 'section') {
                        const sectionId = element.closest('.column').dataset.sectionId;
                        success = await deleteSection(sectionId);
                    } else if (itemType === 'board') {
                        let boardId;
                        const listItem = element.closest('li');
                        if (listItem) {
                            boardId = listItem.dataset.boardId;
                        } else if (element.closest('#currentBoard')) {
                            // If deleting from the board title, use the active board ID
                            boardId = appState.activeBoard;
                        }
                        if (!boardId) {
                            throw new Error('Board ID not found');
                        }
                        success = await deleteBoard(boardId);
                    }
                    
                    if (success) {
                        renderActiveBoard();
                        if (itemType === 'board') {
                            renderBoards();
                        }
                    }
                } catch (error) {
                    console.error(`Failed to delete ${itemType}:`, error);
                }
            }
        };
        
        editContainer.appendChild(input);
        if (!isDescription) {
            editContainer.appendChild(deleteBtn);
        }
        
        // Add editing class to show background
        element.classList.add('editing');
        
        const saveEdit = async () => {
            if (isConfirming) {
                element.innerHTML = text;
                element.classList.remove('editing');
                return;
            }
            
            const newText = input.value.trim();
            if (newText !== text) {
                const success = await onSave(newText);
                if (success) {
                    if (isDescription && !newText) {
                        renderActiveBoard(); // Re-render to show the arrow hook
                    } else {
                        element.innerHTML = isDescription ? window.linkify(newText) : newText;
                    }
                } else {
                    element.innerHTML = isDescription ? window.linkify(text) : text;
                }
            } else {
                element.innerHTML = isDescription ? window.linkify(text) : text;
            }
            element.classList.remove('editing');
        };

        const cancelEdit = () => {
            element.innerHTML = isDescription ? window.linkify(text) : text;
            element.classList.remove('editing');
            input.removeEventListener('blur', saveEdit);
        };

        input.addEventListener('blur', (e) => {
            // Don't save if clicking the delete button
            if (e.relatedTarget !== deleteBtn) {
                saveEdit();
            }
        });

        // Replace the content with the input
        element.textContent = '';
        element.appendChild(editContainer);
        input.focus();
        if (!isDescription) {
            // For title, put cursor at end instead of selecting all
            input.setSelectionRange(input.value.length, input.value.length);
        } else {
            // For descriptions, put cursor at end
            input.setSelectionRange(input.value.length, input.value.length);
        }

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
    });
}

/**
 * Initializes calendar input slide functionality for date entry
 * Creates expandable date input trays for calendar badges
 * Handles date entry, validation, and API updates
 * @param {Object} appState - Application state containing task data
 */
export function initCalendarInputSlide(appState) {
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
                const task = appState.tasks[taskId];
                
                if (task && task.dueDate) {
                    dateInput.value = new Date(task.dueDate).toLocaleDateString();
                }
            }
        });
        
        // Handle input interactions
        dateInput.addEventListener('blur', async () => {
            const inputValue = dateInput.value.trim();
            
            try {
                // Find task data from DOM
                const taskElement = badge.closest('.task');
                if (!taskElement) return;
                
                const taskId = taskElement.dataset.taskId;
                const task = appState.tasks[taskId];
                if (!task) return;
                
                // Dumb date parsing - if it works, it works!
                let parsedDate = null;
                if (inputValue) {
                    parsedDate = window.DumbDateParser.parseDate(inputValue);
                }
                
                // If we got a date, use it. If not, no date!
                const response = await window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dueDate: parsedDate ? parsedDate.toISOString() : null })
                });
                
                if (response.ok) {
                    const updatedTask = await response.json();
                    appState.tasks[task.id] = updatedTask;
                    
                    // Show it worked
                    badge.classList.toggle('has-due-date', !!parsedDate);
                    badge.setAttribute('title', parsedDate ? `Due: ${parsedDate.toLocaleDateString()}` : 'No due date');
                    
                    // Close it
                    dateTray.classList.remove('open');
                }
            } catch (error) {
                console.error('Error updating task date:', error);
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

/**
 * Shows an error message to the user that automatically disappears after a timeout
 * @param {string} message - The error message to display
 */
export function showError(message) {
    const errorContainer = document.getElementById('error-container') || createErrorContainer();
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

/**
 * Creates an error container element if it doesn't exist
 * @returns {HTMLElement} The error container element
 */
export function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'error-message';
    document.body.appendChild(container);
    return container;
}

// Add error message styles
const style = document.createElement('style');
style.textContent = `
.error-message {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #ff4444;
    color: white;
    padding: 15px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 1000;
    display: none;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
`;
document.head.appendChild(style);

/**
 * Creates an inline editor for adding new tasks within a section
 * Provides a text input field with save/cancel functionality
 * 
 * @param {string} sectionId - ID of the section to add the task to
 * @param {HTMLElement} addTaskBtn - The "Add Task" button element that triggered the editor
 * @returns {void}
 */
export function createInlineTaskEditor(sectionId, addTaskBtn) {
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
        if (isProcessing) return; // Prevent multiple submissions
        isProcessing = true;
        
        const title = input.value.trim();
        if (title) {
            try {
                // Explicitly pass board ID when calling addTask
                const boardId = window.state.activeBoard;
                
                console.log('Saving task in section:', sectionId, 'with board ID:', boardId);
                
                // Add a loading state to indicate task is being created
                input.disabled = true;
                input.classList.add('saving');
                
                try {
                    // Set a timeout for the API call to handle network issues
                    const taskPromise = window.addTask(sectionId, title, '', 'active', null, null, boardId);
                    
                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timed out')), 8000);
                    });
                    
                    // Race the task creation against the timeout
                    const task = await Promise.race([taskPromise, timeoutPromise]);
                    
                    console.log('Task created successfully:', task);
                    
                    if (keepEditorOpen) {
                        input.value = '';
                        input.disabled = false;
                        input.classList.remove('saving');
                        input.focus();
                    } else {
                        closeEditor();
                    }
                    
                    // Force a board refresh just in case
                    if (typeof window.refreshBoard === 'function') {
                        console.log('Explicitly refreshing board after task creation');
                        window.refreshBoard(window.state, window.elements);
                    }
                } catch (error) {
                    console.error('Error adding task:', error);
                    
                    // Show error to user
                    const errorMessage = error.message || 'Failed to add task. Please try again.';
                    if (typeof window.showError === 'function') {
                        window.showError(errorMessage);
                    } else {
                        alert(errorMessage);
                    }
                    
                    input.disabled = false;
                    input.classList.remove('saving');
                    
                    if (!keepEditorOpen) {
                        closeEditor();
                    }
                }
            } catch (error) {
                console.error('Error adding task:', error);
                
                // Show error to user
                const errorMessage = error.message || 'Failed to add task. Please try again.';
                if (typeof window.showError === 'function') {
                    window.showError(errorMessage);
                } else {
                    alert(errorMessage);
                }
                
                input.disabled = false;
                input.classList.remove('saving');
                
                if (!keepEditorOpen) {
                    closeEditor();
                }
            }
        } else {
            closeEditor();
            isProcessing = false;
        }
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

// Expose functions on window for backward compatibility
// These assignments ensure that legacy code can still access the functions
if (typeof window !== 'undefined') {
    window.makeEditable = makeEditable;
    window.initCalendarInputSlide = initCalendarInputSlide;
    window.showError = showError;
    window.createErrorContainer = createErrorContainer;
    window.createInlineTaskEditor = createInlineTaskEditor;
    window.initCreditVisibility = initCreditVisibility;
} 