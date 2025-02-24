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
    
    // Get the latest task data from state
    const state = window.state || {};
    const currentTask = state.tasks[task.id] || task;
    
    const isNewTask = !currentTask.id;
    elements.taskModal.querySelector('h2').textContent = isNewTask ? 'Add Task' : 'Edit Task';
    elements.taskTitle.value = isNewTask ? '' : (currentTask.title || '');
    elements.taskDescription.value = isNewTask ? '' : (currentTask.description || '');
    elements.taskStatus.value = isNewTask ? 'active' : (currentTask.status || 'active');
    elements.taskForm.dataset.taskId = currentTask.id || '';
    elements.taskForm.dataset.sectionId = currentTask.sectionId;

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
    const elements = window.elements || {};
    if (!elements.taskModal) return;
    
    // Add closing class to trigger slide down animation
    elements.taskModal.classList.add('closing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        elements.taskModal.classList.remove('closing');
        elements.taskModal.hidden = true;
        // Reset form and clear all datasets if it exists
        if (elements.taskForm) {
            elements.taskForm.reset();
            elements.taskForm.dataset.taskId = '';
            elements.taskForm.dataset.sectionId = '';
            // Clear raw input datasets
            if (elements.taskDueDate) {
                delete elements.taskDueDate.dataset.rawInput;
                delete elements.taskDueDate.dataset.originalDate;
            }
            if (elements.taskStartDate) {
                delete elements.taskStartDate.dataset.rawInput;
                delete elements.taskStartDate.dataset.originalDate;
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
 * @returns {Promise<void>}
 */
async function addTask(sectionId, title, description = '', status = 'active', dueDate = null, startDate = null) {
    const state = window.state || {};
    
    try {
        if (!sectionId) {
            console.error('Section ID is required to add a task');
            return;
        }
        
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${sectionId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        // Update just the tasks container instead of full re-render
        const tasksContainer = document.querySelector(`.column[data-section-id="${sectionId}"] .tasks`);
        if (tasksContainer) {
            const taskEl = window.renderTask(data);
            if (taskEl) {
                tasksContainer.appendChild(taskEl);
            }
        }
    } catch (error) {
        console.error('Failed to add task:', error);
    }
}

// Expose functions globally
window.showTaskModal = showTaskModal;
window.hideTaskModal = hideTaskModal;
window.addTask = addTask;
