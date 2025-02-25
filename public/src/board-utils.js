/**
 * Board management utilities
 * Functions for managing boards, sections, and related operations
 * Handles CRUD operations for board/section organization
 */

/**
 * Deletes a section from a board
 * @param {string} sectionId - The ID of the section to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export async function deleteSection(sectionId) {
    try {
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/boards/${window.state.activeBoard}/sections/${sectionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            delete window.state.sections[sectionId];
            const board = window.state.boards[window.state.activeBoard];
            if (board) {
                const sectionIndex = board.sectionOrder.indexOf(sectionId);
                if (sectionIndex !== -1) {
                    board.sectionOrder.splice(sectionIndex, 1);
                }
                const section = window.state.sections[sectionId];
                if (section && Array.isArray(section.taskIds)) {
                    section.taskIds.forEach(taskId => delete window.state.tasks[taskId]);
                }
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting section:', error);
        return false;
    }
}

/**
 * Deletes a board and all its associated sections and tasks
 * @param {string} boardId - The ID of the board to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export async function deleteBoard(boardId) {
    try {
        const response = await window.loggedFetch(`${window.appConfig.basePath}/api/boards/${boardId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            Object.entries(window.state.sections).forEach(([sectionId, section]) => {
                if (section.boardId === boardId) {
                    section.taskIds.forEach(taskId => delete window.state.tasks[taskId]);
                    delete window.state.sections[sectionId];
                }
            });
            delete window.state.boards[boardId];
            if (window.state.activeBoard === boardId) {
                const remainingBoards = Object.keys(window.state.boards);
                window.state.activeBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting board:', error);
        return false;
    }
}

/**
 * Creates a new board with the specified name
 * @param {string} name - The name of the board to create
 * @returns {Promise<void>}
 */
export async function createBoard(name) {
    try {
        const response = await window.loggedFetch(window.appConfig.basePath + '/api/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            const board = await response.json();
            window.state.boards[board.id] = board;
            window.renderBoards(window.state, window.elements);
            window.switchBoard(board.id);
        }
    } catch (error) {
        console.error('Failed to create board:', error);
    }
}

/**
 * Switches to the specified board
 * @param {string} boardId - The ID of the board to switch to
 * @returns {Promise<void>}
 */
export async function switchBoard(boardId) {
    if (!window.state.boards[boardId]) return;
    
    window.state.activeBoard = boardId;
    localStorage.setItem('lastActiveBoard', boardId);
    
    // Update URL without reloading the page
    const url = new URL(window.location);
    url.searchParams.set('board', boardId);
    window.history.pushState({}, '', url);
    
    // Use window render functions
    window.renderBoards(window.state, window.elements);
    window.renderActiveBoard(window.state, window.elements);
    
    // Update page title
    document.title = `${window.state.boards[boardId].name || 'Unnamed Board'} - DumbKan`;
}

// Expose functions to window object for use in non-module scripts
window.deleteSection = deleteSection;
window.deleteBoard = deleteBoard;
window.createBoard = createBoard;
window.switchBoard = switchBoard; 