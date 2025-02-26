/**
 * Event listener initializer module
 * Handles setting up all application event listeners
 * Responsible for binding UI events to their respective handlers
 */

/**
 * Initializes all event listeners for the application
 * @param {Object} state - The application state object
 * @param {Object} elements - DOM elements used by the application
 */
function initEventListeners(state, elements) {
    // Theme toggle
    elements.themeToggle.addEventListener('click', window.toggleTheme);

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
            window.hideTaskModal();
        });
    }

    // Close task modal when clicking outside
    elements.taskModal?.addEventListener('click', (e) => {
        if (e.target === elements.taskModal) {
            window.hideTaskModal();
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
        
        // Get the title from the appropriate source
        let title;
        if (elements.taskTitleHidden) {
            // First try the hidden field which holds the latest value
            title = elements.taskTitleHidden.value.trim();
        } 
        
        if (!title && elements.taskTitleDisplay) {
            // If not found or empty, try the display element
            title = elements.taskTitleDisplay.textContent.trim();
        }
        
        if (!title && elements.taskTitle) {
            // Last resort, try the original input field
            title = elements.taskTitle.value.trim();
        }
        
        const description = elements.taskDescription.value.trim();
        // Get the status from the select element (already updated by the status toggle)
        const status = elements.taskStatus.value;
        
        // Get raw date values
        const rawDueDate = elements.taskDueDate.value.trim();
        const rawStartDate = elements.taskStartDate.value.trim();
        
        // Only parse dates if they were entered
        let parsedDueDate = null;
        let parsedStartDate = null;
        
        if (rawDueDate) {
            try {
                parsedDueDate = window.DumbDateParser.parseDate(rawDueDate);
                
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
                parsedStartDate = window.DumbDateParser.parseDate(rawStartDate);
                
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
                const response = await window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${taskId}`, {
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
    initDateInputHandlers(elements);
}

/**
 * Initializes date input handlers for form fields
 * Adds blur, keydown, and touch events for date parsing
 * @param {Object} elements - DOM elements containing date inputs
 */
function initDateInputHandlers(elements) {
    const handleDateInput = (input) => {
        const handleDateBlur = () => {
            const value = input.value.trim();
            if (value) {
                const parsedDate = window.DumbDateParser.parseDate(value);
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

/**
 * Initializes modal handlers for task and confirmation modals
 * Sets up event listeners for closing, backdrop clicks, and action buttons
 * @param {Object} elements - DOM elements object containing modal references
 */
function initModalHandlers(elements) {
    // Handle task modal
    if (elements.taskModal) {
        const closeBtn = elements.taskModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => window.hideTaskModal());
        }
        
        // Close on backdrop click
        elements.taskModal.addEventListener('click', (e) => {
            if (e.target === elements.taskModal) {
                window.hideTaskModal();
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

// Expose the functions globally for backward compatibility
window.initEventListeners = initEventListeners;
window.initDateInputHandlers = initDateInputHandlers;
window.initModalHandlers = initModalHandlers;

// Export as ES module
export { initEventListeners, initDateInputHandlers, initModalHandlers }; 