/**
 * Core Drag and Drop Utilities
 * This module provides fundamental utilities for drag-and-drop operations, including:
 * - Throttling function for performance
 * - Element position calculation utilities
 * - Array comparison utilities
 * - Safe JSON parsing
 */

/**
 * Determines the element after which a dragged item should be placed
 * based on the horizontal position of the cursor
 * @param {Array<Element>} elements - Array of elements to check position against
 * @param {number} x - The horizontal position of the cursor/touch
 * @returns {Element|null} - The element after which the dragged item should be placed, or null if it should be placed last
 */
function getDragAfterElement(elements, x) {
    // Filter out the add column button if it's in the elements array
    const columnsOnly = elements.filter(element => !element.classList.contains('add-column-btn'));
    
    const draggableElements = columnsOnly.filter(element => {
        const box = element.getBoundingClientRect();
        return x < box.left + box.width / 2;
    });
    
    return draggableElements[0];
}

/**
 * Creates a throttled version of a function that only executes once per specified interval
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - The throttled function
 */
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        if (!lastRan) {
            func.apply(this, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Utility function to compare two arrays for equality
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {boolean} - True if arrays are equal
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Safely parses JSON with improved error handling
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object|null} - The parsed object or null if parsing failed
 */
function safeJsonParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing JSON data:', error);
        return null;
    }
}

// DOM element cache for improved performance
const elementCache = {
    get addColumnBtn() {
        return document.querySelector('.add-column-btn');
    },
    get columnsContainer() {
        return document.getElementById('columns');
    },
    getDraggingTask() {
        return document.querySelector('.task.dragging');
    },
    getDraggingColumn() {
        return document.querySelector('.column.dragging');
    },
    // Flag to track if we're currently processing a drag operation
    isProcessingDrag: false
};

/**
 * Ensures the add column button is positioned at the end of the columns container
 * @param {Element} columnsContainer - The container holding all columns
 */
function ensureAddColumnButtonIsLast(columnsContainer) {
    const addColumnBtn = elementCache.addColumnBtn;
    if (addColumnBtn && columnsContainer) {
        columnsContainer.appendChild(addColumnBtn);
    }
}

export {
    getDragAfterElement,
    throttle,
    arraysEqual,
    safeJsonParse,
    elementCache,
    ensureAddColumnButtonIsLast
}; 