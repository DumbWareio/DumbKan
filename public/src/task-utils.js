// Task Management Utility Functions

async function updateTask(task, updates) {
    try {
        const response = await loggedFetch(`${window.appConfig.basePath}/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
                    
        if (response.ok) {
            const updatedTask = await response.json();
            state.tasks[task.id] = updatedTask;
            return updatedTask;
        }
        return null;
    } catch (error) {
        console.error('Failed to update task:', error);
        return null;
    }
}

// Expose the function for use in other scripts
window.updateTask = updateTask;

export { updateTask }; 