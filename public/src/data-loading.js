/**
 * Data Loading Module - Handles API data loading and state management
 * Responsible for fetching boards, sections, and tasks and updating the application state
 * @module data-loading
 */

/**
 * Shows a user-friendly error message when API requests fail
 * @param {Error} error - The error object
 * @param {string} message - A custom message to display
 */
function showErrorMessage(error, message) {
    const errorContainer = document.getElementById('errorContainer') || createErrorContainer();
    errorContainer.textContent = message || 'An error occurred loading data. Please try again.';
    errorContainer.style.display = 'block';
    
    // If it's an authentication error, show login prompt
    if (error?.message?.includes('Authentication required')) {
        errorContainer.innerHTML = 'Please <a href="/login.html">log in</a> to view your boards.';
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 10000);
}

/**
 * Creates an error container if it doesn't exist
 * @returns {HTMLElement} The error container element
 */
function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'errorContainer';
    container.className = 'error-message';
    container.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: var(--error-color); color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000; display: none;';
    document.body.appendChild(container);
    return container;
}

/**
 * Loads boards, sections, and tasks from the API and updates the state
 * Handles error handling and selection of the active board
 * @async
 * @returns {Promise<void>} A promise that resolves when data is loaded and state is updated
 */
async function loadBoards() {
    console.log('[Debug] loadBoards() called', {
        hasApiCall: typeof window.apiCall === 'function',
        hasAppConfig: typeof window.appConfig === 'object',
        appConfigBasePath: window.appConfig?.basePath,
        stateType: typeof window.state,
        windowStateType: typeof window.state,
        stateId: window.state ? `Local state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
        windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined'
    });

    try {
        if (!window.appConfig) {
            console.error('[Debug] Configuration not loaded');
            throw new Error('Configuration not loaded');
        }

        // Add cache-busting parameter
        const timestamp = new Date().getTime();
        // Use the API URL from config, which now has the correct protocol
        const url = `${window.appConfig.apiUrl}/api/boards?_=${timestamp}`;
        
        console.log('[Debug] Attempting to load boards from:', url);
        
        const data = await window.apiCall(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        console.log('[Debug] Boards API response:', data);

        // Validate the response data
        if (!data || typeof data.boards !== 'object') {
            console.error('[Debug] Invalid boards data:', data);
            throw new Error('Invalid boards data received');
        }

        // Update the global state
        window.state.boards = data.boards;
        window.state.lastUpdated = new Date();

        // Here's the problem: this overwrites the state variable entirely
        // We should merge data into state instead of reassigning
        console.log('[Debug] State before update:', {
            windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            windowBoards: window.state?.boards ? Object.keys(window.state.boards).length : 0
        });
        
        // Instead of replacing state, merge the data into the existing state
        if (window.state) {
            // Merge data into window.state instead of replacing
            window.state.boards = data.boards || {};
            window.state.sections = data.sections || {};
            window.state.tasks = data.tasks || {};
            window.state.activeBoard = data.activeBoard;
            
            console.log('[Debug] Using MERGED state update');
        } else {
            // Initialize window.state if it doesn't exist yet
            window.state = data;
            console.log('[Debug] Using DIRECT state update');
        }
        
        console.log('[Debug] State after update:', {
            windowStateId: window.state ? `Global state obj #${Math.random().toString(36).substr(2, 9)}` : 'undefined',
            windowBoards: window.state?.boards ? Object.keys(window.state.boards).length : 0
        });

        // Select active board
        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('board');
        
        console.log('[Debug] Board selection:', {
            urlBoardId: boardId,
            availableBoards: Object.keys(window.state.boards)
        });

        if (boardId && window.state.boards[boardId]) {
            window.state.activeBoard = boardId;
        } else {
            const lastActiveBoard = localStorage.getItem('lastActiveBoard');
            if (lastActiveBoard && window.state.boards[lastActiveBoard]) {
                window.state.activeBoard = lastActiveBoard;
            } else if (Object.keys(window.state.boards).length > 0) {
                window.state.activeBoard = Object.keys(window.state.boards)[0];
            }
        }
        
        console.log('[Debug] Final board state:', {
            activeBoard: window.state.activeBoard,
            totalBoards: Object.keys(window.state.boards).length
        });

        // If we have an active board, load it
        if (window.state.activeBoard) {
            await window.switchBoard(window.state.activeBoard);
        }

        // Use window.renderBoards instead of local renderBoards
        window.renderBoards(window.state, window.elements);

    } catch (error) {
        console.log('[Debug] Error in loadBoards:', {
            error: error.message,
            stack: error.stack,
            online: navigator.onLine
        });

        // Show user-friendly error message
        if (error.message.includes('Authentication required')) {
            showErrorMessage(error, 'Authentication required. Please log in.');
        } else if (!navigator.onLine) {
            showErrorMessage(error, 'You are offline. Please check your internet connection.');
        } else {
            showErrorMessage(error, 'Failed to load boards. Please try again later.');
        }
        
        // Clear boards if error is not due to authentication 
        if (!error.message.includes('Authentication')) {
            window.state.boards = {};
        }
        
        return null;
    }
}

/**
 * Loads boards with retry logic using exponential backoff
 * Will attempt to load boards multiple times before giving up
 * @async
 * @returns {Promise<void>} A promise that resolves when data is loaded or max retries are exhausted
 */
async function loadBoardsWithRetry() {
    let retryCount = 0;
    const maxRetries = 3;

    async function retry() {
        try {
            await loadBoards();
        } catch (error) {
            console.error(`Failed to load boards (attempt ${retryCount + 1}/${maxRetries}):`, error);
            if (retryCount < maxRetries) {
                retryCount++;
                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                await retry();
            } else {
                // Final error handling
                window.showError('Failed to load boards after multiple attempts');
            }
        }
    }

    await retry();
}

// Expose functions globally
window.loadBoards = loadBoards;
window.loadBoardsWithRetry = loadBoardsWithRetry;

// Export as ES module
export {
    loadBoards,
    loadBoardsWithRetry
}; 