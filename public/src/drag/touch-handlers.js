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
    const draggedTask = document.querySelector('.task.dragging');
    const draggedColumn = document.querySelector('.column.dragging');

    // Only proceed if we have a dragging element
    if (!draggedTask && !draggedColumn) return;
    
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
    const touch = e.changedTouches[0];
    
    // Get the columns container and all columns
    const columnsContainer = document.getElementById('columns');
    if (!columnsContainer) return;
    
    // Get all column elements
    const allColumns = [...columnsContainer.querySelectorAll('.column')];
    
    // Get the section ID of the dragged column
    const sectionId = draggedColumn.dataset.sectionId;
    if (!sectionId) return;
    
    // Get the active board
    const board = window.state.boards[window.state.activeBoard];
    if (!board) return;
    
    // Calculate the position where the column should be placed
    const afterElement = getDragAfterElement(allColumns, touch.clientX);
    
    // Determine the new index for the column
    let newIndex;
    if (afterElement) {
        newIndex = board.sectionOrder.indexOf(afterElement.dataset.sectionId);
    } else {
        // Place at the end if no afterElement
        newIndex = allColumns.length - 1; // -1 because we don't count the add column button
    }
    
    // If the column wasn't moved, don't do anything
    const currentIndex = board.sectionOrder.indexOf(sectionId);
    if (currentIndex === newIndex) return;
    
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