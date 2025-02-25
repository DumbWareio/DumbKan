/**
 * Application state management module
 * Provides centralized state storage for the application
 * Exports the state object that is used across the application
 */

// Initial application state
export const state = {
    boards: {},
    sections: {},
    tasks: {},
    activeBoard: null
};

/**
 * Resets the application state to initial values
 * Useful for testing or when clearing user data
 */
export function resetState() {
    state.boards = {};
    state.sections = {};
    state.tasks = {};
    state.activeBoard = null;
}

/**
 * Gets the current state object
 * @returns {Object} The current application state
 */
export function getState() {
    return state;
}

// Make state available as a global for backward compatibility
// Note: The main script.js will still set window.state in the init function
// This is just a fallback to ensure modules can access it before init
if (typeof window !== 'undefined') {
    // We don't override window.state here to avoid conflicts
    // with the initialization in script.js
    if (!window.state) {
        window.state = state;
    }
} 