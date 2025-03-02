/**
 * Touch Event Handlers for Drag and Drop
 * This module provides touch-specific event handlers for drag-and-drop operations, including:
 * - Touch event simulation of drag events
 * - Mobile-specific touch handling for both tasks and columns
 */

import { getDragAfterElement } from './core-utils.js';

/**
 * Handles the touch start event for both tasks and columns
 * Creates and dispatches synthetic drag start events
 * @param {TouchEvent} e - The touch start event
 */
function handleTouchStart(e) {
    console.log('Touch start detected on element:', e.target);
    
    // Check for task drag handle
    const taskDragHandle = e.target.closest('.task-drag-handle');
    if (taskDragHandle) {
        console.log('Task drag handle identified, handling task touch start');
        handleTaskTouchStart(e, taskDragHandle);
        return;
    }
    
    // Check for column drag handle
    const columnDragHandle = e.target.closest('.column-drag-handle');
    if (columnDragHandle) {
        console.log('Column drag handle identified, handling column touch start');
        handleColumnTouchStart(e, columnDragHandle);
        return;
    }
    
    console.log('No drag handle identified in touch start');
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
    console.log('Column touch start detected', dragHandle);
    const columnHeader = dragHandle.closest('.column-header');
    if (!columnHeader) {
        console.warn('No column header found for drag handle');
        return;
    }
    
    const column = columnHeader.closest('.column');
    if (!column) {
        console.warn('No column found for column header');
        return;
    }
    
    e.preventDefault(); // Prevent scrolling while dragging
    
    console.log('Creating synthetic dragstart event for column:', column.dataset.sectionId);
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
    
    // Add the dragging class to visually indicate the drag
    column.classList.add('dragging');
    
    column.dispatchEvent(dragStartEvent);
}

/**
 * Handles touch movement during a drag operation
 * Creates and dispatches synthetic dragover events
 * @param {TouchEvent} e - The touch move event
 */
function handleTouchMove(e) {
    const draggedTask = document.querySelector('.task.dragging');
    const draggedColumn = document.querySelector('.column.dragging');

    // Only proceed if we have a dragging element
    if (!draggedTask && !draggedColumn) {
        // No dragging element detected
        return;
    }
    
    // Log which type of element is being dragged
    if (draggedTask) {
        console.log('Touch move with dragged task');
    } else if (draggedColumn) {
        console.log('Touch move with dragged column');
    }
    
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
        console.log('Element under touch:', elementUnderTouch);
        elementUnderTouch.dispatchEvent(dragOverEvent);
    } else {
        console.warn('No element found under touch point');
    }
}

/**
 * Handles the end of a touch drag operation
 * Creates and dispatches synthetic drop and dragend events
 * @param {TouchEvent} e - The touch end event
 */
function handleTouchEnd(e) {
    const draggedTask = document.querySelector('.task.dragging');
    const draggedColumn = document.querySelector('.column.dragging');
    
    // Handle task drop
    if (draggedTask) {
        handleTaskTouchEnd(e, draggedTask);
    }
    // Handle column drop
    else if (draggedColumn) {
        handleColumnTouchEnd(e, draggedColumn);
    }
}

/**
 * Handles touch end specifically for tasks
 * @param {TouchEvent} e - The touch end event
 * @param {Element} draggedTask - The dragged task element
 */
function handleTaskTouchEnd(e, draggedTask) {
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

/**
 * Handles touch end specifically for columns
 * @param {TouchEvent} e - The touch end event
 * @param {Element} draggedColumn - The dragged column element
 */
function handleColumnTouchEnd(e, draggedColumn) {
    console.log('Column touch end detected', draggedColumn);
    const touch = e.changedTouches[0];
    
    // Get the columns container and all columns
    const columnsContainer = document.getElementById('columns');
    if (!columnsContainer) {
        console.warn('No columns container found');
        return;
    }
    
    // Get all column elements EXCEPT the dragged one to avoid self-placement issues
    const allColumns = [...columnsContainer.querySelectorAll('.column:not(.dragging):not(.add-column-btn)')];
    console.log(`Found ${allColumns.length} columns for placement calculation (excluding dragged column)`);
    
    // Get the section ID of the dragged column
    const sectionId = draggedColumn.dataset.sectionId;
    if (!sectionId) {
        console.warn('Dragged column has no section ID');
        return;
    }
    
    // Get the active board
    const board = window.state.boards[window.state.activeBoard];
    if (!board) {
        console.warn('No active board found in state');
        return;
    }
    
    // Calculate the position where the column should be placed
    // We use the modified list that excludes the dragged column
    const afterElement = getDragAfterElement(allColumns, touch.clientX);
    
    // Current index in the board's section order
    const currentIndex = board.sectionOrder.indexOf(sectionId);
    if (currentIndex === -1) {
        console.warn(`Section ${sectionId} not found in board section order`);
        return;
    }
    
    // Determine the new index
    let newIndex;
    if (afterElement) {
        const afterElementId = afterElement.dataset.sectionId;
        // Get the index in the full section order (not our filtered DOM list)
        const afterElementIndex = board.sectionOrder.indexOf(afterElementId);
        if (afterElementIndex === -1) {
            console.warn(`After element section ${afterElementId} not found in board order`);
            return;
        }
        
        // If dropping after an element that was before the dragged item in the original order,
        // we can use its index directly
        if (afterElementIndex < currentIndex) {
            newIndex = afterElementIndex;
        } else {
            // Otherwise, we need to account for the shifted position
            newIndex = afterElementIndex - 1;
        }
        
        console.log(`Column will be placed before: ${afterElementId} at adjusted index ${newIndex}`);
    } else {
        // Place at the end
        newIndex = board.sectionOrder.length - 1;
        console.log(`Column will be placed at the end, index ${newIndex}`);
    }
    
    // Validate the new index makes sense
    if (newIndex < 0 || newIndex >= board.sectionOrder.length) {
        console.warn(`Invalid new index ${newIndex}, must be between 0 and ${board.sectionOrder.length - 1}`);
        newIndex = Math.max(0, Math.min(newIndex, board.sectionOrder.length - 1));
    }
    
    // If the column wasn't moved, don't do anything
    if (currentIndex === newIndex) {
        console.log('Column was not moved (same position)');
        return;
    }
    
    console.log(`Moving column from index ${currentIndex} to ${newIndex}`);
    
    // PROBLEM: The synthetic drop event approach isn't saving to the server
    // Let's directly call the handleSectionMove function to ensure server update
    if (typeof window.handleSectionMove === 'function') {
        console.log(`Directly calling handleSectionMove for section ${sectionId} to position ${newIndex}`);
        window.handleSectionMove(sectionId, newIndex).then(() => {
            console.log('Section move completed successfully via direct call');
        }).catch(error => {
            console.error('Failed to move section via direct call:', error);
        });
        
        // Remove dragging class
        draggedColumn.classList.remove('dragging');
        return; // Skip the synthetic event approach since we're handling it directly
    }
    
    // If handleSectionMove isn't available, fall back to synthetic events
    console.log('handleSectionMove not available, falling back to synthetic events');
    // Create a synthetic drop event for the column
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/json', JSON.stringify({
        sectionId,
        type: 'section',
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
    
    // Dispatch the drop event
    columnsContainer.dispatchEvent(dropEvent);
    
    // Create and dispatch dragend event
    const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true
    });
    draggedColumn.dispatchEvent(dragEndEvent);
}

export {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTaskTouchEnd,
    handleColumnTouchEnd
}; 