/**
 * Drag and Drop Utilities
 * This module provides utilities for drag-and-drop operations, including:
 * - Touch event handling for mobile drag-and-drop functionality
 * - Position calculation utilities for placing dragged elements
 * - Simulated drag-and-drop events on touch devices
 * - Section (column) drag-and-drop functionality
 */

/**
 * Determines the element after which a dragged item should be placed
 * based on the horizontal position of the cursor
 * @param {Array<Element>} elements - Array of elements to check position against
 * @param {number} x - The horizontal position of the cursor/touch
 * @returns {Element|null} - The element after which the dragged item should be placed, or null if it should be placed last
 */
function getDragAfterElement(elements, x) {
    const draggableElements = elements.filter(element => {
        const box = element.getBoundingClientRect();
        return x < box.left + box.width / 2;
    });
    
    return draggableElements[0];
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

    const columns = [...document.querySelectorAll('.column:not(.dragging)')];
    const afterElement = getDragAfterElement(columns, e.clientX);
    
    if (afterElement) {
        column.parentNode.insertBefore(draggingElement, afterElement);
    } else {
        column.parentNode.appendChild(draggingElement);
    }
}

/**
 * Handles the drop event for a section (column)
 * Finalizes the section move operation
 * @param {DragEvent} e - The drop event
 */
async function handleSectionDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.column');
    if (!column) return;

    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type !== 'section') return;

        const { sectionId } = data;
        const columns = [...document.querySelectorAll('.column')];
        const newIndex = columns.indexOf(column);
        
        if (newIndex !== -1) {
            await handleSectionMove(sectionId, newIndex);
        }
    } catch (error) {
        console.error('Error handling section drop:', error);
        window.loadBoards();
    }
}

/**
 * Handles the start of a touch on a draggable task
 * Creates and dispatches a synthetic dragstart event
 * @param {TouchEvent} e - The touch start event
 */
function handleTouchStart(e) {
    const dragHandle = e.target.closest('.task-drag-handle');
    if (!dragHandle) return;

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

// Export all functions
export {
    getDragAfterElement,
    handleSectionMove,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
};

// Make functions available on window for legacy code
window.handleTouchStart = handleTouchStart;
window.handleTouchMove = handleTouchMove;
window.handleTouchEnd = handleTouchEnd;
window.getDragAfterElement = getDragAfterElement;
window.handleSectionMove = handleSectionMove;
window.handleSectionDragStart = handleSectionDragStart;
window.handleSectionDragOver = handleSectionDragOver;
window.handleSectionDrop = handleSectionDrop; 