// Task Management Utility Functions

// Ensure loggedFetch is available globally
if (typeof window.loggedFetch !== 'function') {
    console.warn('loggedFetch is not defined. Make sure it is loaded before task-utils.js');
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

// Expose the function globally
window.updateTask = updateTask; 