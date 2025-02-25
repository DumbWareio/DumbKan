/**
 * Drag and Drop Utilities
 * This module provides utilities for drag-and-drop operations, including:
 * - Touch event handling for mobile drag-and-drop functionality
 * - Position calculation utilities for placing dragged elements
 * - Simulated drag-and-drop events on touch devices
 * - Section (column) drag-and-drop functionality
 * - General drag-and-drop event handlers for tasks and columns
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
 * Handles the drag start event for both tasks and columns
 * Adds the dragging class and sets up the data transfer
 * @param {DragEvent} e - The drag start event
 */
function handleDragStart(e) {
    const task = e.target.closest('.task');
    const columnHeader = e.target.closest('.column-header');
    
    if (task && !columnHeader) {
        task.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: task.dataset.taskId,
            sourceSectionId: task.closest('.column').dataset.sectionId,
            type: 'task'
        }));
    } else if (columnHeader) {
        const column = columnHeader.closest('.column');
        if (column) {
            column.classList.add('dragging');
            e.dataTransfer.setData('application/json', JSON.stringify({
                sectionId: column.dataset.sectionId,
                type: 'section'
            }));
        }
    }
    e.dataTransfer.effectAllowed = 'move';
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

// DOM element cache
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
    }
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

/**
 * Positions a dragged column based on cursor position
 * @param {Element} draggingColumn - The column being dragged
 * @param {Element} columnsContainer - The container holding all columns
 * @param {number} clientX - Horizontal position of cursor/touch
 */
function positionDraggedColumn(draggingColumn, columnsContainer, clientX) {
    // Ensure add column button is positioned correctly first
    ensureAddColumnButtonIsLast(columnsContainer);
    
    // Get columns for position calculation
    const columns = [...document.querySelectorAll('.column:not(.dragging)')];
    const afterElement = getDragAfterElement(columns, clientX);
    
    // Position the dragged column
    if (afterElement) {
        columnsContainer.insertBefore(draggingColumn, afterElement);
    } else {
        columnsContainer.appendChild(draggingColumn);
    }
    
    // Ensure add column button is at the end again after positioning
    ensureAddColumnButtonIsLast(columnsContainer);
}

// Throttle the potentially high-frequency drag over handlers
const throttledPositionDraggedColumn = throttle(positionDraggedColumn, 30); // 30ms throttle

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
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
    const draggingTask = elementCache.getDraggingTask();
    if (draggingTask) {
        column.classList.add('drag-over');
        const tasksContainer = column.querySelector('.tasks');
        if (!tasksContainer) return;
    
        // Use requestAnimationFrame for smoother task positioning
        requestAnimationFrame(() => {
            const siblings = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
            const nextSibling = siblings.find(sibling => {
                const rect = sibling.getBoundingClientRect();
                return clientY < rect.top + rect.height / 2;
            });
        
            if (nextSibling) {
                tasksContainer.insertBefore(draggingTask, nextSibling);
            } else {
                tasksContainer.appendChild(draggingTask);
            }
        });
    } else {
        const draggingColumn = elementCache.getDraggingColumn();
        if (draggingColumn) {
            throttledPositionDraggedColumn(draggingColumn, column.parentNode, clientX);
        }
    }
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
 * Handles dropping a task
 * @param {Object} data - The drop data
 * @param {Element} column - The target column element
 */
async function handleTaskDrop(data, column) {
    const { taskId, sourceSectionId, toSectionId, newIndex: providedIndex } = data;
    
    if (!taskId || !sourceSectionId) {
        console.warn('Missing required task data in drop event');
        return;
    }
    
    const targetSectionId = toSectionId || column.dataset.sectionId;
    if (!targetSectionId) {
        console.warn('No target section ID found');
        return;
    }
    
    const tasksContainer = column.querySelector('.tasks');
    if (!tasksContainer) {
        console.warn('Tasks container not found in column');
        return;
    }

    const task = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!task) {
        console.warn(`Task with ID ${taskId} not found`);
        return;
    }

    let newIndex = providedIndex;
    if (typeof newIndex !== 'number') {
        const siblings = [...tasksContainer.querySelectorAll('.task')];
        newIndex = siblings.indexOf(task);
    }

    try {
        await window.handleTaskMove(taskId, sourceSectionId, targetSectionId, newIndex);
    } catch (error) {
        console.error('Failed to move task:', error);
        if (window.showToast) {
            window.showToast('Failed to move task. Please try again.', 'error');
        }
    }
}

/**
 * Handles dropping a section (column)
 * @param {Object} data - The drop data 
 * @param {Element} column - The target column element
 */
async function handleSectionDrop(data, column) {
    const { sectionId } = data;
    
    if (!sectionId) {
        console.warn('Missing section ID in drop data');
        return;
    }
    
    const columns = [...document.querySelectorAll('.column')];
    const newIndex = columns.indexOf(column);
    
    if (newIndex === -1) {
        console.warn('Target column not found in columns list');
        return;
    }
    
    // Ensure the "add column" button is at the end of the columns container
    ensureAddColumnButtonIsLast(column.parentNode);
    
    try {
        await handleSectionMove(sectionId, newIndex);
    } catch (error) {
        console.error('Failed to move section:', error);
        if (window.showToast) {
            window.showToast('Failed to move column. Please try again.', 'error');
        }
    }
}

/**
 * Handles the drag end event for both tasks and columns
 * Removes the dragging and drag-over classes
 * @param {DragEvent} e - The drag end event
 */
function handleDragEnd(e) {
    document.querySelectorAll('.task.dragging, .column.dragging').forEach(el => {
        el.classList.remove('dragging');
    });
    document.querySelectorAll('.column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

/**
 * Moves a section (column) to a new position in the board
 * Handles both API request and local state update
 * @param {string} sectionId - The ID of the section to move
 * @param {number} newIndex - The new position index for the section
 */
async function handleSectionMove(sectionId, newIndex) {
    try {
        const boardId = window.state.activeBoard;
        const response = await fetch(`${window.appConfig.basePath}/api/boards/${boardId}/sections/${sectionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newIndex })
        });

        if (!response.ok) {
            throw new Error('Failed to move section');
        }

        // Update local state
        const board = window.state.boards[boardId];
        const currentIndex = board.sectionOrder.indexOf(sectionId);
        if (currentIndex !== -1) {
            board.sectionOrder.splice(currentIndex, 1);
            board.sectionOrder.splice(newIndex, 0, sectionId);
        }

        // Ensure the "add column" button is at the end of the columns container
        const addColumnBtn = document.querySelector('.add-column-btn');
        const columnsContainer = document.getElementById('columns');
        if (addColumnBtn && columnsContainer) {
            columnsContainer.appendChild(addColumnBtn);
        }

        // Use the window function for rendering
        if (typeof window.renderActiveBoard === 'function') {
            window.renderActiveBoard(window.state, window.elements);
        } else {
            console.warn('renderActiveBoard not available');
        }
    } catch (error) {
        console.error('Failed to move section:', error);
        window.loadBoards(); // Reload the board state in case of error
    }
}

/**
 * Handles the drag start event for a section (column)
 * Sets up the necessary data for drag and drop operation
 * @param {DragEvent} e - The drag start event
 */
function handleSectionDragStart(e) {
    const column = e.target.closest('.column');
    if (!column) return;
    
    column.classList.add('dragging');
    e.dataTransfer.setData('application/json', JSON.stringify({
        sectionId: column.dataset.sectionId,
        type: 'section'
    }));
    e.dataTransfer.effectAllowed = 'move';
}

/**
 * Handles the drag over event for a section (column)
 * Updates the visual position of the dragged section
 * @param {DragEvent} e - The drag over event
 */
function handleSectionDragOver(e) {
    e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;

    const draggingElement = document.querySelector('.column.dragging');
    if (!draggingElement) return;

    positionDraggedColumn(draggingElement, column.parentNode, e.clientX);
}

/**
 * Enhanced touch event handling for both tasks and columns
 * Creates and dispatches synthetic drag events for touch devices
 * @param {TouchEvent} e - The touch start event
 */
function handleTouchStart(e) {
    // Check for task drag handle
    const taskDragHandle = e.target.closest('.task-drag-handle');
    if (taskDragHandle) {
        handleTaskTouchStart(e, taskDragHandle);
        return;
    }
    
    // Check for column drag handle
    const columnDragHandle = e.target.closest('.column-drag-handle');
    if (columnDragHandle) {
        handleColumnTouchStart(e, columnDragHandle);
    }
}

/**
 * Handles touch start for tasks
 * @param {TouchEvent} e - The touch event
 * @param {Element} dragHandle - The task's drag handle element
 */
function handleTaskTouchStart(e, dragHandle) {
    const task = dragHandle.closest('.task');
    if (!task) return;

    e.preventDefault(); // Prevent scrolling while dragging

    // Create and dispatch dragstart event
    const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
    });

    // Set the data that would normally be set in dragstart
    dragStartEvent.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.dataset.taskId,
        sourceSectionId: task.closest('.column').dataset.sectionId,
        type: 'task'
    }));

    task.dispatchEvent(dragStartEvent);
}

/**
 * Handles touch start for columns
 * @param {TouchEvent} e - The touch event
 * @param {Element} dragHandle - The column's drag handle element
 */
function handleColumnTouchStart(e, dragHandle) {
    const columnHeader = dragHandle.closest('.column-header');
    if (!columnHeader) return;
    
    const column = columnHeader.closest('.column');
    if (!column) return;
    
    e.preventDefault(); // Prevent scrolling while dragging
    
    // Create and dispatch dragstart event
    const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
    });
    
    // Set the data that would normally be set in dragstart
    dragStartEvent.dataTransfer.setData('application/json', JSON.stringify({
        sectionId: column.dataset.sectionId,
        type: 'section'
    }));
    
    column.dispatchEvent(dragStartEvent);
}

/**
 * Handles touch movement during a drag operation
 * Creates and dispatches synthetic dragover events
 * @param {TouchEvent} e - The touch move event
 */
function handleTouchMove(e) {
    if (!document.querySelector('.task.dragging')) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    // Create and dispatch dragover event
    const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        dataTransfer: new DataTransfer()
    });
    
    // Find the element under the touch point
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementUnderTouch) {
        elementUnderTouch.dispatchEvent(dragOverEvent);
    }
}

/**
 * Handles the end of a touch drag operation
 * Creates and dispatches synthetic drop and dragend events
 * @param {TouchEvent} e - The touch end event
 */
function handleTouchEnd(e) {
    const draggedTask = document.querySelector('.task.dragging');
    if (!draggedTask) return;
    
    const touch = e.changedTouches[0];
    
    // Find the element under the touch point
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!elementUnderTouch) return;
    
    // Find the target column
    const targetColumn = elementUnderTouch.closest('.column');
    if (!targetColumn) return;
    
    // Get the target section ID
    const targetSectionId = targetColumn.dataset.sectionId;
    if (!targetSectionId) return;
    
    // Get the task ID and original section ID
    const taskId = draggedTask.dataset.taskId;
    // Get the original section ID from the task's data in the state
    const task = window.state.tasks[taskId];
    if (!task) return;
    const sourceSectionId = task.sectionId;
    
    // Find the index where the task should be inserted
    const tasksContainer = targetColumn.querySelector('.tasks');
    if (!tasksContainer) return;
    
    const siblings = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
    const nextSibling = siblings.find(sibling => {
        const rect = sibling.getBoundingClientRect();
        return touch.clientY < rect.top + rect.height / 2;
    });
    
    const newIndex = nextSibling ? siblings.indexOf(nextSibling) : siblings.length;
    
    // Only proceed if we're moving to a different section or a different position in the same section
    if (sourceSectionId === targetSectionId) {
        const currentIndex = window.state.sections[sourceSectionId].taskIds.indexOf(taskId);
        if (currentIndex === newIndex) return; // Don't proceed if position hasn't changed
    }
    
    // Create DataTransfer object with all necessary data
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/json', JSON.stringify({
        taskId,
        sourceSectionId,
        type: 'task',
        toSectionId: targetSectionId,
        newIndex
    }));
    
    // Create and dispatch drop event
    const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        dataTransfer
    });
    
    // Dispatch the event on the target column
    targetColumn.dispatchEvent(dropEvent);
    
    // Create and dispatch dragend event
    const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true
    });
    draggedTask.dispatchEvent(dragEndEvent);
}

// Export all functions as named exports according to ES Module standards
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
    
    // Utility functions
    getDragAfterElement,
    throttle,
    ensureAddColumnButtonIsLast,
    positionDraggedColumn,
    safeJsonParse
};

// Make core functions available on window for legacy code compatibility
// This approach is transitional until all code is migrated to ES modules
const legacyFunctions = {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getDragAfterElement,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleSectionMove,
    handleSectionDragStart,
    handleSectionDragOver
};

// Attach to window object
Object.entries(legacyFunctions).forEach(([name, func]) => {
    window[name] = func;
});

/**
 * Module Documentation
 * 
 * This module handles drag-and-drop operations for both tasks and columns in the kanban board.
 * It supports both mouse and touch interactions, with special handling for mobile devices.
 * 
 * Main features:
 * - Task dragging within and between columns
 * - Column reordering with proper positioning
 * - Touch support for mobile devices
 * - Performance optimizations for smooth dragging
 * - Error handling and recovery
 * 
 * Dependencies:
 * - Relies on window.handleTaskMove for task movement
 * - Uses window.state for board state
 * - Uses window.loadBoards and window.renderActiveBoard for rendering
 * 
 * Implementation Notes:
 * - Uses the HTML5 Drag and Drop API for desktop
 * - Simulates drag events via touch events for mobile
 * - Uses throttling to prevent performance issues with rapid events
 * - Ensures the "add column" button stays correctly positioned during operations
 */ 