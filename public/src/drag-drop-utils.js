/**
 * DEPRECATED: Backward Compatibility Module for Drag and Drop Utilities
 * This module re-exports all functionality from the new modular implementation
 * for backward compatibility purposes.
 * 
 * Please import directly from '/src/drag/index.js' or specific sub-modules in new code.
 */

// Re-export everything from the new main module
export * from './drag/index.js';

// Also provide the legacy global bindings for backward compatibility
import * as DragDropUtils from './drag/index.js';

// Backward compatibility globals for legacy code
// These are already attached to window in the index.js, but we'll duplicate it here
// to ensure backward compatibility in all scenarios
const legacyFunctions = {
    handleTouchStart: DragDropUtils.handleTouchStart,
    handleTouchMove: DragDropUtils.handleTouchMove,
    handleTouchEnd: DragDropUtils.handleTouchEnd,
    handleTaskTouchEnd: DragDropUtils.handleTaskTouchEnd,
    handleColumnTouchEnd: DragDropUtils.handleColumnTouchEnd,
    getDragAfterElement: DragDropUtils.getDragAfterElement,
    handleDragStart: DragDropUtils.handleDragStart,
    handleDragEnd: DragDropUtils.handleDragEnd,
    handleDragOver: DragDropUtils.handleDragOver,
    handleDrop: DragDropUtils.handleDrop,
    handleSectionMove: DragDropUtils.handleSectionMove,
    handleSectionDragStart: DragDropUtils.handleSectionDragStart,
    handleSectionDragOver: DragDropUtils.handleSectionDragOver
};

// Ensure these functions are available globally
Object.entries(legacyFunctions).forEach(([name, func]) => {
    window[name] = func;
}); 