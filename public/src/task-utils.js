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
 * Handles moving a task to a different section or position
 * @param {string} taskId - ID of the task being moved
 * @param {string} fromSectionId - ID of the source section
 * @param {string} toSectionId - ID of the destination section
 * @param {number} newPosition - New position index in the destination section
 * @returns {Promise<Object>} - The updated task data
 */
window.handleTaskMove = async function(taskId, fromSectionId, toSectionId, newPosition) {
    const boardId = window.state.activeBoard;
    if (!boardId) {
        throw new Error('No active board');
    }

    console.log(`Moving task ${taskId} from section ${fromSectionId} to section ${toSectionId} at position ${newPosition}`);
    
    // Debug state structure to understand what we're working with
    console.log('Current state structure:', {
        tasksIsArray: Array.isArray(window.state.tasks),
        tasksType: typeof window.state.tasks,
        sectionsIsArray: Array.isArray(window.state.sections),
        sectionsType: typeof window.state.sections,
        taskCount: window.state.tasks ? Object.keys(window.state.tasks).length : 0,
        sectionCount: window.state.sections ? Object.keys(window.state.sections).length : 0
    });
    
    try {
        // Make API call to move task
        const response = await window.loggedFetch(
            `${window.appConfig.basePath}/api/tasks/${taskId}/move`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromSectionId,
                    toSectionId,
                    position: newPosition,
                    boardId: boardId // Explicitly include the board ID in case the API needs it
                })
            }
        );
        
        // Check if response contains data directly (loggedFetch might parse it)
        let data;
        if (response.task) {
            // Response already contains parsed data with task property
            data = response;
            console.log('Task move response contained direct task data:', data);
        } else {
            // Need to parse the JSON response
            try {
                data = await response.json();
                console.log('Task move parsed JSON response:', data);
            } catch (parseError) {
                console.warn('Failed to parse task move response as JSON:', parseError);
                // If we can't parse it but response was OK, return a minimal object
                if (response.ok) {
                    data = { success: true, message: 'Task moved successfully' };
                    console.log('Created minimal success response object');
                } else {
                    throw new Error('Failed to parse server response');
                }
            }
        }
        
        // Update state locally if task data is available
        if (data && data.task) {
            // Update the task in state - tasks is an object with task IDs as keys, not an array
            if (window.state && window.state.tasks) {
                window.state.tasks[taskId] = data.task;
            }

            // Update section task lists if section data is provided
            if (data.sections) {
                // Check if sections is an array or object and update accordingly
                if (Array.isArray(data.sections)) {
                    // Handle array of sections
                    data.sections.forEach(section => {
                        if (window.state.sections[section.id]) {
                            window.state.sections[section.id] = section;
                        }
                    });
                } else {
                    // Handle object of sections where keys are section IDs
                    Object.keys(data.sections).forEach(sectionId => {
                        const section = data.sections[sectionId];
                        if (window.state.sections[sectionId]) {
                            window.state.sections[sectionId] = section;
                        }
                    });
                }
            } else {
                // If server didn't return updated sections, manually update the task lists
                // Remove task from the source section
                const fromSection = window.state.sections[fromSectionId];
                if (fromSection && fromSection.taskIds) {
                    const taskIndex = fromSection.taskIds.indexOf(taskId);
                    if (taskIndex !== -1) {
                        fromSection.taskIds.splice(taskIndex, 1);
                    }
                }
                
                // Add task to the target section
                const toSection = window.state.sections[toSectionId];
                if (toSection && toSection.taskIds) {
                    if (typeof newPosition === 'number' && newPosition >= 0) {
                        toSection.taskIds.splice(newPosition, 0, taskId);
                    } else {
                        toSection.taskIds.push(taskId);
                    }
                }
            }

            // Re-render the board to reflect changes
            if (typeof window.renderBoard === 'function') {
                window.renderBoard(window.state, window.elements);
            } else if (typeof window.renderActiveBoard === 'function') {
                window.renderActiveBoard(window.state, window.elements);
            } else {
                console.warn('No board render function found. Board may need manual refresh.');
            }
        }
        
        return data;
    } catch (error) {
        console.error('Failed to move task:', error);
        throw error;
    }
}

/**
 * Moves a task to the section immediately to the right of its current section
 * @param {string} taskId - The ID of the task to move
 * @param {string} currentSectionId - The ID of the section currently containing the task
 * @returns {Promise<void>} - Promise that resolves when the task has been moved
 */
async function moveTaskRight(taskId, currentSectionId) {
    try {
        // Get the active board state
        if (!window.state || !window.state.boards || !window.state.activeBoard) {
            console.error('Board state not available');
            return;
        }

        const board = window.state.boards[window.state.activeBoard];
        if (!board || !board.sectionOrder) {
            console.error('Invalid board structure');
            return;
        }

        // Find the current section's index
        const currentIndex = board.sectionOrder.indexOf(currentSectionId);
        if (currentIndex === -1) {
            console.error('Current section not found in board');
            return;
        }

        // Check if this is the rightmost section
        if (currentIndex >= board.sectionOrder.length - 1) {
            console.log('Task is already in the rightmost section');
            return;
        }

        // Get the next section
        const nextSectionId = board.sectionOrder[currentIndex + 1];
        if (!nextSectionId) {
            console.error('Next section not found');
            return;
        }

        // Move the task using the handleTaskMove function
        await handleTaskMove(taskId, currentSectionId, nextSectionId, 0);
    } catch (error) {
        console.error('Failed to move task right:', error);
        throw error;
    }
}

// Expose the functions globally
window.updateTask = updateTask;
window.getPrioritySymbol = getPrioritySymbol;
window.deleteTask = deleteTask;
window.handleTaskMove = handleTaskMove;
window.moveTaskRight = moveTaskRight; 