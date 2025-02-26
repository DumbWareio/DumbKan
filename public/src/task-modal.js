/**
 * Task Modal Management Module
 * Handles displaying and managing the task modal for creating and editing tasks
 */

/**
 * Show the task modal for creating or editing a task
 * @param {Object} task - The task object to display or edit
 */
function showTaskModal(task) {
    const elements = window.elements || {};
    if (!elements.taskModal) return;
    
    // Always use the global state object directly
    if (!window.state) {
        console.error('window.state is not initialized - cannot show task modal');
        return;
    }
    
    const currentTask = window.state.tasks && task.id ? window.state.tasks[task.id] || task : task;
    
    const isNewTask = !currentTask.id;
    
    // Set up status toggle
    if (elements.taskStatusToggle) {
        const status = isNewTask ? 'active' : (currentTask.status || 'active');
        elements.taskStatusToggle.className = `badge status-badge ${status}`;
        elements.taskStatusToggle.setAttribute('title', status.charAt(0).toUpperCase() + status.slice(1));
        
        // Add click event to toggle status
        elements.taskStatusToggle.onclick = function() {
            const currentStatus = elements.taskStatus.value;
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            
            // Update the visual status badge
            elements.taskStatusToggle.className = `badge status-badge ${newStatus}`;
            elements.taskStatusToggle.setAttribute('title', newStatus.charAt(0).toUpperCase() + newStatus.slice(1));
            
            // Update the hidden select field value
            elements.taskStatus.value = newStatus;
        };
    }
    
    // Update editable title display element
    const titleDisplay = elements.taskTitleDisplay;
    if (titleDisplay) {
        titleDisplay.textContent = isNewTask ? 'New Task' : (currentTask.title || 'Untitled Task');
        
        // Add click event to make title editable
        titleDisplay.onclick = function() {
            if (elements.taskTitle) {
                // Save the current text content before hiding
                const currentText = titleDisplay.textContent;
                
                // Get the dimensions and position of the display element before hiding it
                const rect = titleDisplay.getBoundingClientRect();
                const styles = window.getComputedStyle(titleDisplay);
                
                // Prepare the input element first, then make it visible
                elements.taskTitle.value = currentText;
                elements.taskTitle.style.width = rect.width + 'px';
                elements.taskTitle.style.height = rect.height + 'px';
                elements.taskTitle.style.lineHeight = styles.lineHeight;
                elements.taskTitle.style.top = '0px'; 
                elements.taskTitle.style.left = '0px';
                elements.taskTitle.style.paddingTop = styles.paddingTop;
                elements.taskTitle.style.paddingBottom = styles.paddingBottom;
                elements.taskTitle.style.fontFamily = styles.fontFamily;
                elements.taskTitle.style.fontSize = styles.fontSize;
                elements.taskTitle.style.fontWeight = styles.fontWeight;
                
                // Switch visibility
                titleDisplay.hidden = true;
                elements.taskTitle.hidden = false;
                elements.taskTitle.focus();
                
                // Also update the hidden form input
                if (elements.taskTitleHidden) {
                    elements.taskTitleHidden.value = titleDisplay.textContent;
                }
                
                // Handle blur event to save changes
                const handleBlur = function() {
                    if (elements.taskTitle.value.trim() !== '') {
                        titleDisplay.textContent = elements.taskTitle.value;
                        if (elements.taskTitleHidden) {
                            elements.taskTitleHidden.value = elements.taskTitle.value;
                        }
                    }
                    titleDisplay.hidden = false;
                    elements.taskTitle.hidden = true;
                    elements.taskTitle.removeEventListener('blur', handleBlur);
                    elements.taskTitle.removeEventListener('keydown', handleKeydown);
                };
                
                // Handle enter key press
                const handleKeydown = function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        elements.taskTitle.blur();
                    }
                };
                
                elements.taskTitle.addEventListener('blur', handleBlur);
                elements.taskTitle.addEventListener('keydown', handleKeydown);
            }
        };
    }
    
    // Set initial form values
    elements.taskForm.dataset.taskId = currentTask.id || '';
    elements.taskForm.dataset.sectionId = currentTask.sectionId;
    
    // Set hidden title field value (for form submission)
    if (elements.taskTitleHidden) {
        elements.taskTitleHidden.value = isNewTask ? '' : (currentTask.title || '');
    }
    
    elements.taskDescription.value = isNewTask ? '' : (currentTask.description || '');
    elements.taskStatus.value = isNewTask ? 'active' : (currentTask.status || 'active');

    // Set date fields - keep raw input
    if (!isNewTask) {
        // Clear any existing event listeners
        const newDueDateInput = elements.taskDueDate.cloneNode(true);
        const newStartDateInput = elements.taskStartDate.cloneNode(true);
        elements.taskDueDate.parentNode.replaceChild(newDueDateInput, elements.taskDueDate);
        elements.taskStartDate.parentNode.replaceChild(newStartDateInput, elements.taskStartDate);
        elements.taskDueDate = newDueDateInput;
        elements.taskStartDate = newStartDateInput;

        // Add focus handlers to select all text
        elements.taskDueDate.addEventListener('focus', (e) => {
            e.target.select();
        });
        elements.taskStartDate.addEventListener('focus', (e) => {
            e.target.select();
        });

        // Set values with human-readable formatting
        if (currentTask.dueDate) {
            // Always show formatted date when opening modal
            const dueDate = new Date(currentTask.dueDate);
            // Check if time is midnight
            const isMidnight = dueDate.getHours() === 0 && dueDate.getMinutes() === 0 && dueDate.getSeconds() === 0;
            if (isMidnight) {
                // If midnight, just show the date
                elements.taskDueDate.value = dueDate.toISOString().split('T')[0];
            } else {
                // If has time, show full format
                elements.taskDueDate.value = window.formatDateHumanReadable(currentTask.dueDate);
            }
            elements.taskDueDate.dataset.originalDate = currentTask.dueDate;
        } else {
            elements.taskDueDate.value = '';
        }
        
        if (currentTask.startDate) {
            // Always show formatted date when opening modal
            const startDate = new Date(currentTask.startDate);
            // Check if time is midnight
            const isMidnight = startDate.getHours() === 0 && startDate.getMinutes() === 0 && startDate.getSeconds() === 0;
            if (isMidnight) {
                // If midnight, just show the date
                elements.taskStartDate.value = startDate.toISOString().split('T')[0];
            } else {
                // If has time, show full format
                elements.taskStartDate.value = window.formatDateHumanReadable(currentTask.startDate);
            }
            elements.taskStartDate.dataset.originalDate = currentTask.startDate;
        } else {
            elements.taskStartDate.value = '';
        }
    } else {
        elements.taskDueDate.value = '';
        elements.taskStartDate.value = '';
    }
    
    // Store raw input when user types
    elements.taskDueDate.addEventListener('input', (e) => {
        e.target.dataset.rawInput = e.target.value;
        delete e.target.dataset.originalDate; // Clear original date when user starts typing
    });
    
    elements.taskStartDate.addEventListener('input', (e) => {
        e.target.dataset.rawInput = e.target.value;
        delete e.target.dataset.originalDate; // Clear original date when user starts typing
    });

    // Remove any auto-formatting on blur
    elements.taskDueDate.addEventListener('blur', (e) => {
        if (!e.target.dataset.rawInput && e.target.dataset.originalDate) {
            // If no raw input but we have original date, show formatted date
            e.target.value = window.formatDateHumanReadable(e.target.dataset.originalDate);
        } else {
            e.target.value = e.target.dataset.rawInput || e.target.value;
        }
    });
    
    elements.taskStartDate.addEventListener('blur', (e) => {
        if (!e.target.dataset.rawInput && e.target.dataset.originalDate) {
            // If no raw input but we have original date, show formatted date
            e.target.value = window.formatDateHumanReadable(e.target.dataset.originalDate);
        } else {
            e.target.value = e.target.dataset.rawInput || e.target.value;
        }
    });
    
    // Show/hide delete button based on whether it's a new task
    const deleteBtn = elements.taskModal.querySelector('.btn-delete');
    if (deleteBtn) {
        deleteBtn.style.display = isNewTask ? 'none' : '';
    }

    elements.taskModal.hidden = false;
}

/**
 * Hide the task modal with a closing animation
 */
function hideTaskModal() {
    if (!window.elements || !window.elements.taskModal) return;
    
    // Add closing class to trigger slide down animation
    window.elements.taskModal.classList.add('closing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        window.elements.taskModal.classList.remove('closing');
        window.elements.taskModal.hidden = true;
        // Reset form and clear all datasets if it exists
        if (window.elements.taskForm) {
            window.elements.taskForm.reset();
            window.elements.taskForm.dataset.taskId = '';
            window.elements.taskForm.dataset.sectionId = '';
            // Clear raw input datasets
            if (window.elements.taskDueDate) {
                delete window.elements.taskDueDate.dataset.rawInput;
                delete window.elements.taskDueDate.dataset.originalDate;
            }
            if (window.elements.taskStartDate) {
                delete window.elements.taskStartDate.dataset.rawInput;
                delete window.elements.taskStartDate.dataset.originalDate;
            }
        }
    }, 300); // Match the animation duration
}

/**
 * Add a new task to a section
 * @param {string} sectionId - The ID of the section to add the task to
 * @param {string} title - The title of the task
 * @param {string} [description=''] - The description of the task
 * @param {string} [status='active'] - The status of the task
 * @param {Date} [dueDate=null] - The due date of the task
 * @param {Date} [startDate=null] - The start date of the task
 * @param {string} [boardId=null] - The ID of the board the task belongs to
 * @returns {Promise<void>}
 */
async function addTask(sectionId, title, description = '', status = 'active', dueDate = null, startDate = null, boardId = null) {
    // ALWAYS work with the global state object directly, not a local copy
    // This ensures we're modifying the same state that's used for rendering
    if (!window.state) {
        console.error('window.state is not initialized - cannot add task');
        return;
    }
    
    try {
        if (!sectionId) {
            console.error('Section ID is required to add a task');
            return;
        }
        
        // Add debugging to check active board status
        console.log('Add task details:', {
            sectionId,
            providedBoardId: boardId,
            activeBoard: window.state.activeBoard,
            boardsAvailable: window.state.boards ? Object.keys(window.state.boards) : 'No boards',
            hasBoards: !!window.state.boards,
            hasSections: !!window.state.sections
        });
        
        // Use provided boardId or try to find it from state
        let effectiveBoardId = boardId || window.state.activeBoard;
        
        if (!effectiveBoardId && window.state.boards && window.state.sections && window.state.sections[sectionId]) {
            // Try to find the board containing this section
            const section = window.state.sections[sectionId];
            
            // Loop through boards to find which one contains this section
            for (const bId in window.state.boards) {
                if (window.state.boards[bId].sections && window.state.boards[bId].sections.includes(sectionId)) {
                    effectiveBoardId = bId;
                    console.log(`Found board ${effectiveBoardId} for section ${sectionId}`);
                    break;
                }
            }
        }
        
        if (!effectiveBoardId) {
            console.error('No board ID provided, no active board found, and could not determine board for section:', sectionId);
            throw new Error('Cannot determine which board this task belongs to');
        }
        
        // Before making the API call, ensure the board exists in the state
        console.log('State check before API call:', {
            boardId: effectiveBoardId,
            boardExists: window.state.boards && window.state.boards[effectiveBoardId] ? true : false,
            boardStructure: window.state.boards && window.state.boards[effectiveBoardId] ? 
                window.state.boards[effectiveBoardId].sectionOrder : 'Not available'
        });
        
        // Perform API call with appropriate board ID in path
        const apiEndpoint = `/api/boards/${effectiveBoardId}/sections/${sectionId}/tasks`;
        const response = await apiCall(apiEndpoint, {
            method: 'POST',
            body: JSON.stringify({
                title, 
                description, 
                status, 
                dueDate: dueDate ? dueDate.toISOString() : null,
                startDate: startDate ? startDate.toISOString() : null,
                priority: 'medium' // Set default priority
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        let data;
        try {
            data = await response.json();
            
            if (!data || !data.id) {
                throw new Error('Invalid task data received from server');
            }
        } catch (parseError) {
            console.error('Failed to parse task data:', parseError);
            throw new Error(`Failed to parse task response: ${parseError.message}`);
        }
        
        // Handle case where section might not exist in local state yet
        if (!window.state.sections[sectionId]) {
            console.warn('Section not found in local state:', sectionId);
            
            // Initialize the section in local state if not present
            window.state.sections[sectionId] = {
                id: sectionId,
                taskIds: [],
                boardId: effectiveBoardId,
                name: 'Section ' + sectionId.substring(0, 4) // Add a default name
            };
            
            // Make sure the section is connected to the board
            if (window.state.boards && window.state.boards[effectiveBoardId]) {
                // Initialize sectionOrder if it doesn't exist
                if (!Array.isArray(window.state.boards[effectiveBoardId].sectionOrder)) {
                    window.state.boards[effectiveBoardId].sectionOrder = [];
                }
                
                // Add section to board's sectionOrder if not already there
                if (!window.state.boards[effectiveBoardId].sectionOrder.includes(sectionId)) {
                    window.state.boards[effectiveBoardId].sectionOrder.push(sectionId);
                }
            } else {
                console.warn('Board not found in state or has invalid structure:', effectiveBoardId);
                
                // If board.boards is empty or missing the active board, we might need to reload
                if (!window.state.boards || Object.keys(window.state.boards).length === 0) {
                    console.warn('Boards object is empty or missing - attempting to reload board data');
                    // If we have a loadBoards function, call it to refresh state
                    if (typeof window.loadBoards === 'function') {
                        console.log('Calling loadBoards to refresh board data');
                        await window.loadBoards();
                        
                        // After reloading, check again if the board exists
                        if (window.state.boards && window.state.boards[effectiveBoardId]) {
                            console.log('Board data reloaded successfully');
                        } else {
                            console.error('Board still not found after reload');
                        }
                    }
                }
            }
        }
        
        // Add the task to state
        window.state.tasks[data.id] = data;
        
        // Make sure taskIds is an array
        if (!Array.isArray(window.state.sections[sectionId].taskIds)) {
            window.state.sections[sectionId].taskIds = [];
        }
        
        // Add task to section's task list
        window.state.sections[sectionId].taskIds.push(data.id);
        
        // Final state check before refresh
        console.log('Final state check before refresh:', {
            boardId: effectiveBoardId,
            boardExists: window.state.boards && window.state.boards[effectiveBoardId] ? true : false,
            boardsKeys: window.state.boards ? Object.keys(window.state.boards) : 'No boards',
            activeBoard: window.state.activeBoard,
            sectionExists: !!window.state.sections[sectionId]
        });
        
        // Refresh the UI to show the new task
        if (typeof window.refreshBoard === 'function') {
            // Ensure state has activeBoard set
            if (!window.state.activeBoard && effectiveBoardId) {
                window.state.activeBoard = effectiveBoardId;
                console.log('Setting active board for refresh:', effectiveBoardId);
            }
            
            try {
                // Use the global state object for refresh
                window.refreshBoard(window.state, window.elements);
                console.log('Board refreshed successfully after adding task:', data.id);
            } catch (refreshError) {
                console.error('Error refreshing board after adding task:', refreshError);
                // Even if refresh fails, we'll return the data
            }
        } else {
            console.warn('refreshBoard function not available - UI may not update immediately');
        }
        
        return data;
    } catch (error) {
        console.error('Failed to add task:', error);
        // Don't nest error messages, just pass it through
        throw error;
    }
}

// Expose functions globally
window.showTaskModal = showTaskModal;
window.hideTaskModal = hideTaskModal;
window.addTask = addTask;
