/**
 * Application initialization module
 * Provides functionality to bootstrap and initialize the application
 * Handles element initialization, state management, and initial data loading
 */

// Import required dependencies
import { initRenderFunctions } from './render-init.js';
import { state } from './state.js';
import { initCreditVisibility } from './ui-utils.js';
import { initElements } from './element-init.js';

/**
 * Initializes the application by setting up all required components and resources
 * @returns {Promise<void>} Promise that resolves when initialization is complete
 * @throws {Error} If initialization fails
 */
export async function init() {
    console.log('Initializing application');
    
    // Initialize credit visibility feature
    initCreditVisibility();
    
    // Skip board initialization for login page
    if (window.location.pathname.includes('login.html')) {
        console.log('Login page detected, skipping board initialization');
        return;
    }
    
    // Proceed with board/main application initialization
    console.log('Setting up main application elements');
    
    // Initialize DOM elements
    const elements = initElements();
    
    // Make state and elements globally available
    window.state = state; // Maintain backward compatibility with imported state
    window.elements = elements;
    
    // Initialize render functions
    initRenderFunctions();
    
    // Initialize theme (using global function from theme.js)
    if (typeof window.initTheme === 'function') {
        window.initTheme();
    } else {
        console.error('initTheme function not found. Ensure theme.js is loaded properly.');
    }
    
    // Initialize event listeners (using global function from event-listeners.js)
    if (typeof window.initEventListeners === 'function') {
        window.initEventListeners(state, elements);
    } else {
        console.error('initEventListeners function not found. Ensure event-listeners.js is loaded properly.');
    }

    // Load boards with retry logic (using global function from data-loading.js)
    if (typeof window.loadBoardsWithRetry === 'function') {
        await window.loadBoardsWithRetry();
    } else {
        console.error('loadBoardsWithRetry function not found. Ensure data-loading.js is loaded properly.');
    }

    // Initialize modal handlers (using global function from event-listeners.js)
    if (typeof window.initModalHandlers === 'function') {
        window.initModalHandlers(elements);
    } else {
        console.error('initModalHandlers function not found. Ensure event-listeners.js is loaded properly.');
    }
} 