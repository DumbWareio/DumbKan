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

/**
 * Moves a task from one section to another or reorders within the same section
 * @param {string} taskId - The ID of the task to move
 * @param {string} fromSectionId - The source section ID
 * @param {string} toSectionId - The target section ID
 * @param {number} newIndex - The new position within the target section
 * @returns {Promise<void>} - Promise that resolves when the task is moved
 */
async function handleTaskMove(taskId, fromSectionId, toSectionId, newIndex) {
    try {
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${taskId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toSectionId,
                newIndex
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to move task');
        }

        // Get the updated task data from the response
        const updatedData = await response.json();
        
        // Update local state with the response data
        if (updatedData.task) {
            window.state.tasks[taskId] = updatedData.task;
        }
        
        if (updatedData.sections) {
            // Update the sections with their new task orders
            Object.assign(window.state.sections, updatedData.sections);
        } else {
            // Fallback to manual state update if server doesn't provide section data
            const fromSection = window.state.sections[fromSectionId];
            const toSection = window.state.sections[toSectionId];

            if (fromSection && toSection) {
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
                if (window.state.tasks[taskId]) {
                    window.state.tasks[taskId].sectionId = toSectionId;
                }
            }
        }
        
        // Only re-render if we successfully updated the state
        // Use the window function reference for consistency
        if (typeof window.renderActiveBoard === 'function') {
            window.renderActiveBoard(window.state, window.elements);
        } else {
            console.warn('renderActiveBoard not available');
        }
    } catch (error) {
        console.error('Failed to move task:', error);
        throw error;
    }
}

// Expose the functions globally
window.updateTask = updateTask;
window.getPrioritySymbol = getPrioritySymbol;
window.deleteTask = deleteTask;
window.handleTaskMove = handleTaskMove; 