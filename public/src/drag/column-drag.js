/**
 * Column Drag and Drop Functionality
 * This module provides utilities for column drag-and-drop operations, including:
 * - Column positioning during drag
 * - Column drag event handlers
 * - Column move API integration
 */

import { 
    getDragAfterElement, 
    throttle, 
    elementCache, 
    ensureAddColumnButtonIsLast,
    arraysEqual
} from './core-utils.js';

/**
 * Positions a dragged column based on cursor position
 * @param {Element} draggingColumn - The column being dragged
 * @param {Element} columnsContainer - The container holding all columns
 * @param {number} clientX - Horizontal position of cursor/touch
 */
function positionDraggedColumn(draggingColumn, columnsContainer, clientX) {
    if (!draggingColumn || !columnsContainer) {
        console.warn('Missing required elements for drag positioning');
        return;
    }
    
    // Store the column ID for verification
    const columnId = draggingColumn.dataset.sectionId;
    if (!columnId) {
        console.warn('Missing section ID on dragged column');
        return;
    }
    
    // Ensure add column button is positioned correctly first
    ensureAddColumnButtonIsLast(columnsContainer);
    
    // Get columns for position calculation, excluding the dragging column
    const columns = [...columnsContainer.querySelectorAll('.column:not(.dragging):not(.add-column-btn)')];
    
    // Find the column where the dragged item should be placed after
    const afterElement = getDragAfterElement(columns, clientX);
    
    // Only reposition if needed to avoid unnecessary DOM changes
    const currentPrevSibling = draggingColumn.previousElementSibling;
    const currentNextSibling = draggingColumn.nextElementSibling;
    
    let shouldReposition = false;
    
    // Prevent trying to position an element before itself - this can cause duplication
    if (afterElement && afterElement.dataset.sectionId === columnId) {
        console.log(`Preventing self-insertion of column ${columnId}`);
        return;
    }
    
    // Check if this is a duplicate column - if we have another element with the same sectionId already
    // Don't count the dragging column itself
    const duplicateCheck = [...columnsContainer.querySelectorAll(`.column:not(.dragging)[data-section-id="${columnId}"]`)];
    if (duplicateCheck.length > 0) {
        console.warn(`Detected potential duplicate column with ID ${columnId}, preventing insertion`);
        return;
    }
    
    if (afterElement) {
        shouldReposition = afterElement !== draggingColumn && afterElement !== currentNextSibling;
    } else {
        // Should be placed at the end, check if it's already there
        shouldReposition = currentNextSibling !== null && !currentNextSibling.classList.contains('add-column-btn');
    }
    
    // Store last repositioning coordinates to avoid unnecessary DOM operations
    if (!draggingColumn._lastDragX) {
        draggingColumn._lastDragX = clientX;
    }
    
    // Only reposition if mouse moved significantly (at least 30px) since last repositioning
    const hasMovedSignificantly = Math.abs(draggingColumn._lastDragX - clientX) > 30;
    shouldReposition = shouldReposition && hasMovedSignificantly;
    
    if (shouldReposition) {
        // Update the last drag position when we actually reposition
        draggingColumn._lastDragX = clientX;
        
        // Position the dragged column
        if (afterElement) {
            // Log only when actual repositioning happens
            console.log(`Inserting column ${columnId} before`, afterElement.dataset.sectionId);
            columnsContainer.insertBefore(draggingColumn, afterElement);
        } else {
            // Log only when actual repositioning happens
            console.log(`Appending column ${columnId} to end`);
            columnsContainer.appendChild(draggingColumn);
        }
    }
    
    // Ensure add column button is at the end again after positioning
    ensureAddColumnButtonIsLast(columnsContainer);
}

// Throttle the potentially high-frequency drag over handlers
const throttledPositionDraggedColumn = throttle(positionDraggedColumn, 100);

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
    
    // Skip if we're already processing a drag operation
    // This helps prevent excessive calculations when events come in quickly
    if (elementCache.isProcessingDrag) return;
    
    // Set the flag to indicate we're processing
    elementCache.isProcessingDrag = true;
    
    // Apply throttled position updates
    throttledPositionDraggedColumn(draggingElement, column.parentNode, e.clientX);
    
    // Reset the flag after a short delay
    setTimeout(() => {
        elementCache.isProcessingDrag = false;
    }, 100);
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
    
    // Get all columns, excluding the add column button
    const columns = [...document.querySelectorAll('.column:not(.add-column-btn)')];
    const newIndex = columns.indexOf(column);
    
    if (newIndex === -1) {
        console.warn('Target column not found in columns list');
        return;
    }
    
    // Remove the dragging class immediately to prevent visual duplication
    document.querySelectorAll('.column.dragging').forEach(el => {
        el.classList.remove('dragging');
    });
    
    // Get the current index of the section in state
    const boardId = window.state.activeBoard;
    const board = window.state.boards[boardId];
    const oldIndex = board.sectionOrder.indexOf(sectionId);
    
    // Only proceed if the position actually changed
    if (oldIndex === newIndex) {
        console.log('Section dropped at same position, no changes needed');
        return;
    }
    
    console.log(`Dropping section ${sectionId} from position ${oldIndex} to ${newIndex}`);
    
    // Ensure the "add column" button is at the end of the columns container
    ensureAddColumnButtonIsLast(column.parentNode);
    
    try {
        await handleSectionMove(sectionId, newIndex);
    } catch (error) {
        console.error('Failed to move section:', error);
        if (window.showToast) {
            window.showToast('Failed to move column. Please try again.', 'error');
        } else if (window.showError) {
            window.showError('Failed to move column. Please try again.');
        }
        
        // Force a full board refresh to reset the UI
        window.loadBoards();
    }
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
        console.log(`Moving section ${sectionId} to position ${newIndex} in board ${boardId}`);
        
        // Use loggedFetch instead of fetch for consistent API handling and logging
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/boards/${boardId}/sections/${sectionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newIndex })
        });

        if (!response.ok) {
            throw new Error(`Failed to move section: ${response.status} ${response.statusText}`);
        }

        // Get current section order
        const board = window.state.boards[boardId];
        console.log('Board section order before update:', [...board.sectionOrder]);
        
        // Create a new array instead of modifying the existing one
        const updatedSectionOrder = [...board.sectionOrder];
        const currentIndex = updatedSectionOrder.indexOf(sectionId);
        
        if (currentIndex !== -1) {
            // Only move if the section exists and the position actually changed
            if (currentIndex !== newIndex) {
                // Remove from current position
                updatedSectionOrder.splice(currentIndex, 1);
                // Add at new position
                updatedSectionOrder.splice(newIndex > currentIndex ? newIndex - 1 : newIndex, 0, sectionId);
                
                // Update the board's section order with our new array
                board.sectionOrder = updatedSectionOrder;
                console.log('Board section order after update:', board.sectionOrder);
            } else {
                console.log('Section position unchanged, skipping reorder');
            }
        } else {
            console.warn(`Section ${sectionId} not found in board section order`);
        }

        // Ensure the "add column" button is at the end of the columns container
        ensureAddColumnButtonIsLast(document.getElementById('columns'));

        // Clean up any duplicate columns before rendering
        const columnsContainer = document.getElementById('columns');
        if (columnsContainer) {
            // Find duplicates of the section we just moved
            const duplicateSections = [...columnsContainer.querySelectorAll(`.column[data-section-id="${sectionId}"]`)];
            if (duplicateSections.length > 1) {
                console.warn(`Found ${duplicateSections.length} instances of section ${sectionId}, removing duplicates`);
                // Keep only the first instance
                for (let i = 1; i < duplicateSections.length; i++) {
                    console.log(`Removing duplicate section ${sectionId} at index ${i}`);
                    duplicateSections[i].remove();
                }
            }
        }

        // Render the updated board using the most appropriate render function
        if (typeof window.renderActiveBoard === 'function') {
            console.log('Rendering board after section move');
            window.renderActiveBoard(window.state, window.elements);
        } else if (typeof window.renderBoard === 'function') {
            window.renderBoard(window.state, window.elements);
        } else {
            console.warn('No render function available');
            // Fallback to reload if no render function is available
            window.loadBoards();
        }
    } catch (error) {
        console.error('Failed to move section:', error);
        
        // Show error to user
        if (window.showToast) {
            window.showToast('Failed to move column. Please try again.', 'error');
        } else if (window.showError) {
            window.showError('Failed to move column. Please try again.');
        }
        
        // Force a clean reload of the board state
        console.log('Reloading boards after section move error');
        window.loadBoards();
    }
}

/**
 * Checks for and cleans up any duplicate columns in the DOM
 * Also ensures that the DOM order matches the state order
 * @returns {boolean} - True if duplicates were found and removed
 */
function cleanupColumnDuplicates() {
    const columnsContainer = document.getElementById('columns');
    if (!columnsContainer) {
        console.warn('Could not find columns container for cleanup');
        return false;
    }
    
    let duplicatesFound = false;
    
    // Use a more robust duplicate detection approach
    const sectionIds = new Map(); // Use Map to track the first occurrence of each section
    const allSections = [...columnsContainer.querySelectorAll('.column[data-section-id]')];
    const duplicateSections = [];
    
    // First pass: identify all sections
    allSections.forEach(column => {
        const sectionId = column.dataset.sectionId;
        if (sectionId) {
            if (sectionIds.has(sectionId)) {
                // This is a duplicate, add it to the list
                duplicateSections.push(column);
                console.warn(`Found duplicate section: ${sectionId}`);
                duplicatesFound = true;
            } else {
                // This is the first occurrence, add it to the Map
                sectionIds.set(sectionId, column);
            }
        }
    });
    
    // Remove any duplicated sections
    if (duplicateSections.length > 0) {
        console.warn(`Found ${duplicateSections.length} duplicate sections, removing them`);
        duplicateSections.forEach(section => {
            console.log(`Removing duplicate section: ${section.dataset.sectionId}`);
            section.remove();
        });
        
        // Force a full re-render to ensure consistent state
        if (typeof window.renderActiveBoard === 'function') {
            console.log('Rendering board after removing duplicate sections');
            window.renderActiveBoard(window.state, window.elements);
        } else {
            // If we can't render, force a full reload
            console.log('Forcing full board reload after removing duplicates');
            window.loadBoards();
        }
    }
    
    // Ensure columns match the state's section order
    const boardId = window.state.activeBoard;
    if (boardId && window.state.boards && window.state.boards[boardId]) {
        const board = window.state.boards[boardId];
        if (board.sectionOrder && board.sectionOrder.length > 0) {
            // Get the actual DOM order of columns
            const domSections = [...columnsContainer.querySelectorAll('.column[data-section-id]')];
            const domOrder = domSections.map(col => col.dataset.sectionId);
            
            // Check if DOM order matches state order
            const stateOrder = [...board.sectionOrder];
            const orderMismatch = !arraysEqual(domOrder, stateOrder);
            
            if (orderMismatch) {
                console.warn('Column order in DOM does not match state, forcing re-render');
                if (typeof window.renderActiveBoard === 'function') {
                    window.renderActiveBoard(window.state, window.elements);
                } else {
                    window.loadBoards();
                }
            }
        }
    }
    
    // Ensure the add column button is last
    ensureAddColumnButtonIsLast(columnsContainer);
    
    return duplicatesFound;
}

export {
    positionDraggedColumn,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleSectionMove,
    cleanupColumnDuplicates
}; 