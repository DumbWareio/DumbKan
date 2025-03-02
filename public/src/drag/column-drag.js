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
        
        // Get current section order BEFORE making the API call
        const board = window.state.boards[boardId];
        const originalSectionOrder = [...board.sectionOrder];
        const currentIndex = originalSectionOrder.indexOf(sectionId);

        console.log('Board section order before update:', [...originalSectionOrder]);
        
        // Calculate what the new order should be (for verification)
        const expectedNewOrder = [...originalSectionOrder];
        if (currentIndex !== -1 && currentIndex !== newIndex) {
            // Remove from current position
            expectedNewOrder.splice(currentIndex, 1);
            // Add at new position
            expectedNewOrder.splice(newIndex > currentIndex ? newIndex - 1 : newIndex, 0, sectionId);
            console.log('Expected new order after move:', expectedNewOrder);
        }
        
        // Use loggedFetch instead of fetch for consistent API handling and logging
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/boards/${boardId}/sections/${sectionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newIndex })
        });

        if (!response.ok) {
            throw new Error(`Failed to move section: ${response.status} ${response.statusText}`);
        }

        // Get the response data
        let responseData;
        if (response.data) {
            responseData = response.data;
        } else {
            try {
                responseData = await response.json();
            } catch (error) {
                console.warn('Could not parse server response, using calculated order instead');
                responseData = { success: true };
            }
        }

        // If the server returns an updated sectionOrder, use it
        if (responseData && responseData.sectionOrder) {
            board.sectionOrder = [...responseData.sectionOrder];
            console.log('Using server-provided section order:', board.sectionOrder);
        } else {
            // Otherwise, manually update the order based on our calculations
            if (currentIndex !== -1 && currentIndex !== newIndex) {
                // Use our pre-calculated expected order
                board.sectionOrder = expectedNewOrder;
                console.log('Using client-calculated section order:', board.sectionOrder);
            }
        }

        console.log('Board section order after update:', board.sectionOrder);

        // Ensure the "add column" button is at the end of the columns container
        ensureAddColumnButtonIsLast(document.getElementById('columns'));

        // Clean up any duplicate columns before rendering
        cleanupColumnDuplicates(sectionId);

        // Force a DOM refresh to match the state by directly manipulating the columns container
        const columnsContainer = document.getElementById('columns');
        if (columnsContainer) {
            // Get all current columns except the add button
            const currentColumns = [...columnsContainer.querySelectorAll('.column:not(.add-column-btn)')];
            
            // Re-order the columns in the DOM to match the updated board.sectionOrder
            board.sectionOrder.forEach((id, index) => {
                const columnToMove = currentColumns.find(col => col.dataset.sectionId === id);
                if (columnToMove) {
                    // If this column should be at the end
                    if (index === board.sectionOrder.length - 1) {
                        // Insert before the add button if it exists
                        const addButton = columnsContainer.querySelector('.add-column-btn');
                        if (addButton) {
                            columnsContainer.insertBefore(columnToMove, addButton);
                        } else {
                            columnsContainer.appendChild(columnToMove);
                        }
                    } else {
                        // Find the next column that should come after this one
                        const nextSectionId = board.sectionOrder[index + 1];
                        const nextColumn = currentColumns.find(col => col.dataset.sectionId === nextSectionId);
                        
                        if (nextColumn && nextColumn.parentNode === columnsContainer) {
                            columnsContainer.insertBefore(columnToMove, nextColumn);
                        } else {
                            // If next column not found, just append this column
                            columnsContainer.appendChild(columnToMove);
                        }
                    }
                }
            });
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
 * Removes duplicate column elements from the DOM
 * @param {string} [sectionId] - Optional section ID to focus cleanup on
 * @returns {boolean} - True if duplicates were found and removed
 */
function cleanupColumnDuplicates(sectionId) {
    const columnsContainer = document.getElementById('columns');
    if (!columnsContainer) {
        return false;
    }
    
    let found = false;
    
    // If a specific section ID is provided, only check that section
    if (sectionId) {
        const duplicateSections = [...columnsContainer.querySelectorAll(`.column[data-section-id="${sectionId}"]`)];
        if (duplicateSections.length > 1) {
            console.warn(`Found ${duplicateSections.length} instances of section ${sectionId}, removing duplicates`);
            // Keep only the first instance
            for (let i = 1; i < duplicateSections.length; i++) {
                console.log(`Removing duplicate section ${sectionId} at index ${i}`);
                duplicateSections[i].remove();
            }
            found = true;
        }
        return found;
    }
    
    // Otherwise check all columns
    const allColumns = columnsContainer.querySelectorAll('.column:not(.add-column-btn)');
    const sectionIds = new Set();
    
    // Identify duplicates
    allColumns.forEach(column => {
        const id = column.dataset.sectionId;
        if (!id) return;
        
        if (sectionIds.has(id)) {
            // This is a duplicate, mark for removal
            column.classList.add('duplicate-column');
            found = true;
        } else {
            sectionIds.add(id);
        }
    });
    
    // Remove the duplicates
    const duplicates = columnsContainer.querySelectorAll('.duplicate-column');
    duplicates.forEach(duplicate => {
        console.log(`Removing duplicate column: ${duplicate.dataset.sectionId}`);
        duplicate.remove();
    });
    
    return found;
}

// Export the functions
export {
    positionDraggedColumn,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleSectionMove,
    cleanupColumnDuplicates
}; 