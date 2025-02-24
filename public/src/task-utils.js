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

function updateTask(task, updates) {
    try {
        return window.loggedFetch(`${window.appConfig.basePath}/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).then(response => {
            if (response.ok) {
                return response.json().then(updatedTask => {
                    // Assuming 'state' is a global variable
                    if (window.state && window.state.tasks) {
                        window.state.tasks[task.id] = updatedTask;
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

// Expose the functions globally
window.updateTask = updateTask;
window.getPrioritySymbol = getPrioritySymbol; 