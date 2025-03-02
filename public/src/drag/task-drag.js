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
        
        // If there are no siblings, just append the task
        if (siblings.length === 0) {
            tasksContainer.appendChild(draggingTask);
            return;
        }
        
        // Find the task whose middle point is below the cursor position
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            // Using the middle point (rect.top + rect.height / 2) for more intuitive positioning
            return clientY < rect.top + rect.height / 2;
        });
    
        if (nextSibling) {
            // Insert before the found element
            tasksContainer.insertBefore(draggingTask, nextSibling);
        } else {
            // If no element is found, append at the end
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
    
    // Debug log the initial data
    console.log('Task drop initial data:', { 
        taskId, 
        sourceSectionId, 
        targetSectionId: toSectionId || column?.dataset?.sectionId,
        providedIndex 
    });
    
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
        // Get all tasks including the dragged one
        const allTasks = [...tasksContainer.querySelectorAll('.task')];
        
        // We need to find the position of the dragged task before modifying the DOM
        // If we're in the same section, we need to calculate correctly based on 
        // the task's original position
        const draggingTask = document.querySelector('.task.dragging');
        
        if (draggingTask) {
            // We need to determine the index where the task will be after the drop
            // This accounts for the visual position during dragging
            newIndex = allTasks.indexOf(draggingTask);
            
            // Check if source and target sections are the same
            if (sourceSectionId === targetSectionId) {
                // For same section moves, we need to adjust the index based on
                // the original position of the task in the section
                const fromSection = window.state.sections[sourceSectionId];
                const originalIndex = fromSection?.taskIds.indexOf(taskId);
                
                console.log('Same section task move:', {
                    originalIndex,
                    calculatedNewIndex: newIndex,
                    taskId,
                    sectionId: sourceSectionId,
                    sectionTaskCount: fromSection?.taskIds?.length
                });
                
                // If moving to a later position in the same section, we need to
                // account for the removal of the task from its original position
                if (originalIndex !== -1 && originalIndex < newIndex) {
                    newIndex--;
                    console.log('Adjusted index for same section move:', newIndex);
                }
            } else {
                // Different section move
                const toSection = window.state.sections[targetSectionId];
                
                console.log('Cross-section task move:', {
                    calculatedNewIndex: newIndex,
                    taskId,
                    fromSectionId: sourceSectionId,
                    toSectionId: targetSectionId,
                    toSectionTaskCount: toSection?.taskIds?.length
                });
            }
        } else {
            // Fallback to the old method if no dragging task is found
            newIndex = allTasks.indexOf(task);
            console.log('Fallback position calculation:', newIndex);
        }
    }
    
    console.log(`Final calculated position for task ${taskId}: ${newIndex}`);

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