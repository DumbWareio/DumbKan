// Task Management Utility Functions

// Ensure loggedFetch is available globally
if (typeof window.loggedFetch !== 'function') {
    console.warn('loggedFetch is not defined. Make sure it is loaded before task-utils.js');
}

/**
 * Get the symbol representing a task's priority
 * @param {string} priority - The priority level of the task
 * @returns {string} A symbol representing the priority
 */
function getPrioritySymbol(priority) {
    switch (priority) {
        case 'urgent': return '!';
        case 'high': return '↑';
        case 'medium': return '-';
        case 'low': return '↓';
        default: return '-';
    }
}

/**
 * Updates a task with the provided changes and refreshes the UI
 * @param {Object} task - The task to update
 * @param {Object} updates - The properties to update on the task
 * @returns {Promise<Object|null>} The updated task or null if the update failed
 */
function updateTask(task, updates) {
    try {
        return window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).then(response => {
            if (response.ok) {
                return response.json().then(updatedTask => {
                    // Update the task in state
                    if (window.state && window.state.tasks) {
                        window.state.tasks[task.id] = updatedTask;
                    }
                    
                    // Refresh the UI to show the updated task
                    // This won't refreshed the entire board, only for significant changes
                    const significantChanges = ['title', 'status', 'priority', 'sectionId'];
                    const hasSignificantChanges = Object.keys(updates).some(key => significantChanges.includes(key));
                    
                    if (hasSignificantChanges && typeof window.refreshBoard === 'function') {
                        window.refreshBoard(window.state, window.elements);
                    }
                    
                    return updatedTask;
                });
            }
            return null;
        });
    } catch (error) {
        console.error('Failed to update task:', error);
        return Promise.resolve(null);
    }
}

/**
 * Deletes a task and refreshes the UI
 * @param {string} taskId - The ID of the task to delete
 * @param {string} sectionId - The ID of the section containing the task
 * @returns {Promise<boolean>} Whether the deletion was successful
 */
function deleteTask(taskId, sectionId) {
    try {
        return window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => {
            if (response.ok) {
                // Update local state
                if (window.state) {
                    delete window.state.tasks[taskId];
                    const section = window.state.sections[sectionId];
                    if (section) {
                        const taskIndex = section.taskIds.indexOf(taskId);
                        if (taskIndex !== -1) {
                            section.taskIds.splice(taskIndex, 1);
                        }
                    }
                }
                
                // Hide task modal if open
                if (typeof window.hideTaskModal === 'function') {
                    window.hideTaskModal();
                }
                
                // Refresh the UI
                if (typeof window.refreshBoard === 'function') {
                    window.refreshBoard(window.state, window.elements);
                }
                
                return true;
            }
            return false;
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        return Promise.resolve(false);
    }
}

// Expose the functions globally
window.updateTask = updateTask;
window.getPrioritySymbol = getPrioritySymbol;
window.deleteTask = deleteTask; 