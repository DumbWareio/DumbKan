/**
 * Task Drag and Drop Functionality
 * This module provides utilities for task drag-and-drop operations, including:
 * - Task drag event handlers
 * - Task drop handling
 * - Task move API integration
 */

import { safeJsonParse, elementCache } from './core-utils.js';

/**
 * Handles the drag start event for tasks
 * Adds the dragging class and sets up the data transfer
 * @param {DragEvent} e - The drag start event
 */
function handleTaskDragStart(e) {
    const task = e.target.closest('.task');
    if (!task) return;
    
    const columnHeader = e.target.closest('.column-header');
    if (columnHeader) return; // Don't handle task drag if this is actually a column header
    
    task.classList.add('dragging');
    e.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.dataset.taskId,
        sourceSectionId: task.closest('.column').dataset.sectionId,
        type: 'task'
    }));
    e.dataTransfer.effectAllowed = 'move';
}

/**
 * Handles the task drag over event
 * Updates visual positioning during task drag operations
 * @param {DragEvent} e - The drag over event
 * @param {Element} column - The column being dragged over
 */
function handleTaskDragOver(e, column) {
    if (!column) return;
    
    column.classList.add('drag-over');
    const tasksContainer = column.querySelector('.tasks');
    if (!tasksContainer) return;

    const draggingTask = elementCache.getDraggingTask();
    if (!draggingTask) return;
    
    // Get clientY from either touch or mouse event
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
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
        } else if (window.showError) {
            window.showError('Failed to move task. Please try again.');
        } else {
            // Fallback to alert if neither toast nor error function is available
            alert('Failed to move task. Please try again.');
        }
        
        // Attempt to restore original positions by refreshing the board
        if (typeof window.refreshBoard === 'function') {
            window.refreshBoard(window.state, window.elements);
        } else if (typeof window.renderBoard === 'function') {
            window.renderBoard(window.state, window.elements);
        } else if (typeof window.renderActiveBoard === 'function') {
            window.renderActiveBoard(window.state, window.elements);
        }
    }
}

export {
    handleTaskDragStart,
    handleTaskDragOver,
    handleTaskDrop
}; 