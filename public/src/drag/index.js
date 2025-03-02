/**
 * Drag and Drop Utilities - Main Entry Point
 * This module serves as the main entry point for drag-and-drop functionality.
 * It re-exports functions from the specialized modules and provides backward compatibility
 * with the original global functions.
 * 
 * Note on architecture:
 * - core-utils.js: Basic utilities like throttling, element finding, and array comparison
 * - column-drag.js: Column-specific drag-and-drop functionality
 * - task-drag.js: Task-specific drag-and-drop functionality
 * - touch-handlers.js: Mobile touch event handling for drag-and-drop operations
 */

// Import from specialized modules
import { 
    getDragAfterElement, 
    throttle, 
    arraysEqual, 
    safeJsonParse,
    elementCache,
    ensureAddColumnButtonIsLast
} from './core-utils.js';

import {
    positionDraggedColumn,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleSectionMove,
    cleanupColumnDuplicates
} from './column-drag.js';

import {
    handleTaskDragStart,
    handleTaskDragOver,
    handleTaskDrop
} from './task-drag.js';

import {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTaskTouchEnd,
    handleColumnTouchEnd
} from './touch-handlers.js';

/**
 * Handles the drag start event for both tasks and columns
 * Adds the dragging class and sets up the data transfer
 * @param {DragEvent} e - The drag start event
 */
function handleDragStart(e) {
    const task = e.target.closest('.task');
    const columnHeader = e.target.closest('.column-header');
    
    if (task && !columnHeader) {
        handleTaskDragStart(e);
    } else if (columnHeader) {
        handleSectionDragStart(e);
    }
}

/**
 * Handles the drag over event for both tasks and columns
 * Updates visual positioning during drag operations
 * @param {DragEvent} e - The drag over event
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const column = e.target.closest('.column');
    if (!column) return;
    
    // Get clientX from either touch or mouse event
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    
    const draggingTask = elementCache.getDraggingTask();
    if (draggingTask) {
        handleTaskDragOver(e, column);
    } else {
        const draggingColumn = elementCache.getDraggingColumn();
        if (draggingColumn) {
            handleSectionDragOver(e);
        }
    }
}

/**
 * Handles the drop event for both tasks and columns
 * Finalizes the drag-and-drop operation and updates the data model
 * @param {DragEvent} e - The drop event
 */
async function handleDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;
    
    column.classList.remove('drag-over');
    
    try {
        // Get data transfer content
        let dataTransferContent = e.dataTransfer.getData('application/json');
        if (!dataTransferContent) {
            console.warn('No data found in drop event');
            return;
        }
        
        const data = safeJsonParse(dataTransferContent);
        if (!data) return;
        
        if (data.type === 'task') {
            await handleTaskDrop(data, column);
        } else if (data.type === 'section') {
            await handleSectionDrop(data, column);
        } else {
            console.warn(`Unknown drop data type: ${data.type}`);
        }
    } catch (error) {
        console.error('Error handling drop:', error);
        // Attempt to recover by reloading boards
        try {
            window.loadBoards();
        } catch (reloadError) {
            console.error('Failed to recover from drop error:', reloadError);
            // Inform user that something went wrong
            if (window.showToast) {
                window.showToast('Something went wrong. Please refresh the page.', 'error');
            }
        }
    }
}

/**
 * Handles the drag end event for both tasks and columns
 * Removes the dragging and drag-over classes
 * @param {DragEvent} e - The drag end event
 */
function handleDragEnd(e) {
    console.log('Drag end event detected');
    
    // Reset isProcessingDrag flag to ensure future drags are processed
    elementCache.isProcessingDrag = false;
    
    // Remove dragging classes from all elements
    document.querySelectorAll('.task.dragging').forEach(el => {
        el.classList.remove('dragging');
    });
    
    document.querySelectorAll('.column.dragging').forEach(el => {
        console.log('Removing dragging class from column', el.dataset.sectionId);
        el.classList.remove('dragging');
    });
    
    // Remove drag-over classes from all columns
    document.querySelectorAll('.column.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    // Check the columns container for duplicates after a drag operation
    if (window.cleanupColumnDuplicates) {
        console.log('Running column duplicate cleanup after drag end');
        window.cleanupColumnDuplicates();
    }
}

// Export all functions for use in modular environments
export {
    // Main drag-and-drop handlers
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    
    // Section-specific handlers
    handleSectionMove,
    handleSectionDragStart,
    handleSectionDragOver,
    
    // Touch event handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTaskTouchEnd,
    handleColumnTouchEnd,
    
    // Utility functions
    getDragAfterElement,
    throttle,
    ensureAddColumnButtonIsLast,
    positionDraggedColumn,
    safeJsonParse,
    arraysEqual,
    cleanupColumnDuplicates
};

// Make core functions available on window for legacy code compatibility
// This approach is transitional until all code is migrated to ES modules
const legacyFunctions = {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTaskTouchEnd,
    handleColumnTouchEnd,
    getDragAfterElement,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleSectionMove,
    handleSectionDragStart,
    handleSectionDragOver
};

// Attach to window object for backward compatibility
Object.entries(legacyFunctions).forEach(([name, func]) => {
    window[name] = func;
});

// Expose the functions to the global window object
window.handleDragStart = handleDragStart;
window.handleDragEnd = handleDragEnd;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleTouchStart = handleTouchStart;
window.handleTouchMove = handleTouchMove;
window.handleTouchEnd = handleTouchEnd;
window.cleanupColumnDuplicates = cleanupColumnDuplicates;

// Log the initialization
console.log('Drag and drop handlers initialized'); 