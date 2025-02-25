// All utility functions are now available on the window object
// No need to import them since they're loaded via script tags

// Import render initialization functions
import { initRenderFunctions, refreshUI } from './src/render-init.js';
// Import application state from the state module
import { state, getState } from './src/state.js';
// Import auth storage functions
import { initDB, storeAuthData, getStoredAuth } from './src/auth-storage.js';
// Import login functionality
import { initLogin } from './src/login-utils.js';
// Import UI utilities
import { initCreditVisibility } from './src/ui-utils.js';
// Import DOM element initialization
import { initElements } from './src/element-init.js';
// Import application initialization function
import { init } from './src/app-init.js';
// deleteSection is now available on window object, no need to import

// State Management
// state object has been moved to /public/src/state.js
// Import using: import { state, getState } from './src/state.js';

// Task Management Helper Functions
// All task management functions are now in task-utils.js and task-modal.js

// API Logging wrapper
// loggedFetch function has been moved to /public/src/api-utils.js

// Theme Management functions are now in theme.js
// Use window.initTheme and window.toggleTheme

// Board Management
// loadBoards function has been moved to /public/src/data-loading.js
// Import using: import { loadBoards } from './src/data-loading.js'
import { loadBoards } from './src/data-loading.js';

// renderBoards function has been moved to /public/src/render-utils.js
// Import using: import { renderBoards } from './src/render-utils.js';

// switchBoard function has been moved to /public/src/board-utils.js
// Import using: import { switchBoard } from './src/board-utils.js';

// createBoard function has been moved to /public/src/board-utils.js
// Import using: import { createBoard } from './src/board-utils.js';

// Column Management (UI terminology)
// addColumn function has been moved to /public/src/board-utils.js
// Import using: import { addColumn } from './src/board-utils.js';

// Task Management
// showTaskModal, hideTaskModal, and addTask functions have been moved to /public/src/task-modal.js
// Import using: import { showTaskModal, hideTaskModal, addTask } from './src/task-modal.js'

// Remove the entire function blocks for showTaskModal, hideTaskMove, and addTask

// Drag and Drop
// handleDragStart function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragStart } from './src/drag-drop-utils.js';

// handleDragEnd function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragEnd } from './src/drag-drop-utils.js';

// handleDragOver function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDragOver } from './src/drag-drop-utils.js';

// handleDrop function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleDrop } from './src/drag-drop-utils.js';

// Rendering
// renderActiveBoard function has been moved to /public/src/render-utils.js
// Import using: import { renderActiveBoard } from './src/render-utils.js';

// Event Listeners
// initEventListeners function has been moved to /public/src/event-listeners.js
// Import using: import { initEventListeners } from './src/event-listeners.js'

// Add function to handle modal closing
// initModalHandlers function has been moved to /public/src/event-listeners.js
// Import using: import { initModalHandlers } from './src/event-listeners.js'

// Initialize the application
// init function has been moved to /public/src/app-init.js
// Import using: import { init } from './src/app-init.js';

// Application bootstrap (DOMContentLoaded event handler)
// Has been moved to /public/src/app-bootstrap.js
// Import using: import { bootstrapApplication } from './src/app-bootstrap.js';
// The event listener is now attached in app-bootstrap.js

// Function makeEditable has been moved to /public/src/ui-utils.js
// Remove the entire function block

// Helper function to convert URLs in text to clickable links and include line breaks
// Function has been moved to /public/src/text-utils.js
// Import using: import { linkify } from './src/text-utils.js'

// Section drag and drop
// handleSectionMove function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionMove } from './src/drag-drop-utils.js';

// handleSectionDragStart function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDragStart } from './src/drag-drop-utils.js';

// handleSectionDragOver function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDragOver } from './src/drag-drop-utils.js';

// handleSectionDrop function has been moved to /public/src/drag-drop-utils.js
// Import using: import { handleSectionDrop } from './src/drag-drop-utils.js';

// Update renderColumn function to only make the header draggable
// renderColumn function has been moved to /public/src/render-utils.js
// Import using: import { renderColumn } from './src/render-utils.js';

// handleTaskMove function has been moved to /public/src/task-utils.js
// Import using: import { handleTaskMove } from './src/task-utils.js';

// Add this function to handle moving task to the right
// moveTaskRight function has been moved to /public/src/task-utils.js
// Import using: import { moveTaskRight } from './src/task-utils.js';

// Touch event handling for mobile drag and drop
// handleTouchStart, handleTouchMove, and handleTouchEnd functions have been moved to /public/src/touch-drag.js
// Import using: import { handleTouchStart, handleTouchMove, handleTouchEnd } from './src/touch-drag.js';

// Update renderTask to add touch event listeners
// renderTask function has been moved to /public/src/render-utils.js
// Import using: import { renderTask } from './src/render-utils.js';

// Add back the handleTaskMove function
// handleTaskMove function has been moved to /public/src/task-utils.js
// Import using: import { handleTaskMove } from './src/task-utils.js';

// Add the deleteSection function
// deleteSection function has been moved to /public/src/board-utils.js
// Import using: import { deleteSection } from './src/board-utils.js';

// Add the deleteBoard function
// deleteBoard function has been moved to /public/src/board-utils.js
// Import using: import { deleteBoard } from './src/board-utils.js';

// createInlineTaskEditor function has been moved to /public/src/ui-utils.js
// Import using: import { createInlineTaskEditor } from './src/ui-utils.js';

// Add this function to handle calendar input slide functionality
// initCalendarInputSlide function has been moved to /public/src/ui-utils.js
// Import using: import { initCalendarInputSlide } from './src/ui-utils.js'

// formatDateHumanReadable function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// formatDueDate function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// isPastDue function has been moved to /public/src/date-utils.js
// Keeping this comment to track the function's new location

// API call wrapper with retry logic

// Load boards with retry

// Show error message

// Create error container if it doesn't exist

// Add error message styles

// Expose necessary functions to window for other modules to use
// Note: handleTaskMove function has been moved to task-utils.js and is exposed on the window there
// Note: handleTouchStart, handleTouchMove, and handleTouchEnd functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: handleDragStart, handleDragEnd, handleDragOver, handleDrop functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: handleSectionMove, handleSectionDragStart, handleSectionDragOver, handleSectionDrop functions have been moved to drag-drop-utils.js and are exposed on the window there
// Note: deleteSection, deleteBoard, createBoard, switchBoard, and addColumn functions have been moved to board-utils.js and are exposed on the window there
// Note: createInlineTaskEditor function has been moved to ui-utils.js and is exposed on the window there
// Note: loadBoards is now imported from data-loading.js and is already exposed on the window there
