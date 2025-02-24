/**
 * Render Initialization Module
 * Connects the render utilities to the application and provides initialization
 */

import { renderBoards, renderActiveBoard, refreshBoard } from './render-utils.js';

/**
 * Initialize render functions by connecting them to the window object
 * This enables backward compatibility during migration
 */
export function initRenderFunctions() {
    // Make render functions available globally during migration
    window.renderBoards = (state = window.state, elements = window.elements) => renderBoards(state, elements);
    window.renderActiveBoard = (state = window.state, elements = window.elements) => renderActiveBoard(state, elements);
    window.refreshBoard = (state = window.state, elements = window.elements) => refreshBoard(state, elements);
    
    // Log initialization
    console.log('[Render] Render functions initialized');
}

/**
 * Convenience method to refresh the entire UI
 * This is used after state changes to ensure UI is in sync
 */
export function refreshUI() {
    if (!window.state || !window.elements) {
        console.warn('[Render] Cannot refresh UI: state or elements not initialized');
        return;
    }
    
    refreshBoard(window.state, window.elements);
} 