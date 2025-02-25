/**
 * Render Utilities Module
 * Contains functions for rendering boards, sections, and tasks
 * Centralizes UI refresh logic to avoid redundancy
 */

// Export individual render functions
export { 
    renderBoards, 
    renderActiveBoard, 
    renderColumn, 
    renderTask, 
    refreshBoard
};

/**
 * Renders the list of boards in the sidebar
 * @param {Object} state - Application state
 * @param {Object} elements - DOM elements
 */
function renderBoards(state, elements) {
    if (!elements.boardList) return;
    
    elements.boardList.innerHTML = '';
    if (!state.boards) return;

    Object.values(state.boards).forEach(board => {
        if (!board) return;
        
        const li = document.createElement('li');
        const textSpan = document.createElement('span');
        textSpan.textContent = board.name || 'Unnamed Board';
        li.appendChild(textSpan);
        li.dataset.boardId = board.id;
        if (board.id === state.activeBoard) li.classList.add('active');
        
        li.addEventListener('click', (e) => {
            // Only switch board if not clicking on the editable input
            if (e.target.tagName !== 'INPUT') {
                window.switchBoard(board.id);
            }
        });
        
        elements.boardList.appendChild(li);
    });
}

/**
 * Renders the currently active board with all its sections and tasks
 * @param {Object} state - Application state
 * @param {Object} elements - DOM elements
 */
function renderActiveBoard(state, elements) {
    // Debug log to trace state received by renderActiveBoard
    console.log('RENDER BOARD DEBUG - renderActiveBoard called with:', {
        stateType: typeof state,
        hasActiveBoard: !!state?.activeBoard,
        activeBoardId: state?.activeBoard,
        hasBoards: !!state?.boards,
        boardsType: typeof state?.boards,
        boardsKeys: state?.boards ? Object.keys(state.boards) : 'No boards object',
        activeBoardExists: state?.boards && state?.activeBoard ? !!state.boards[state.activeBoard] : false,
        stateSource: state === window.state ? 'Using window.state' : 'Using provided state'
    });

    // Early validation of board existence
    if (!state.activeBoard || !state.boards) {
        console.warn('No active board or boards state available');
        if (elements.currentBoard) {
            elements.currentBoard.textContent = 'No Board Selected';
        }
        if (elements.columns) {
            elements.columns.innerHTML = '';
        }
        return;
    }

    const board = state.boards[state.activeBoard];
    if (!board) {
        console.warn('Active board not found in boards state');
        console.log('RENDER BOARD DEBUG - Board lookup details:', {
            lookingForId: state.activeBoard,
            availableBoardIds: Object.keys(state.boards),
            boardsStructure: JSON.stringify(state.boards).substring(0, 200) + '...',
            windowStateMatch: state === window.state
        });
        if (elements.currentBoard) {
            elements.currentBoard.textContent = 'Board Not Found';
        }
        if (elements.columns) {
            elements.columns.innerHTML = '';
        }
        return;
    }

    if (!elements.currentBoard || !elements.columns) {
        console.error('Required DOM elements not found');
        return;
    }
            
    // Update board name and make it editable
    elements.currentBoard.textContent = board.name || 'Unnamed Board';
    window.makeEditable(elements.currentBoard, async (newName) => {
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${board.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                const updatedBoard = await response.json();
                state.boards[board.id] = updatedBoard;
                renderBoards(state, elements); // Update the board list to reflect the change
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update board name:', error);
            return false;
        }
    }, state);
    elements.columns.innerHTML = '';

    // Ensure sectionOrder exists and is an array
    if (!board.sectionOrder || !Array.isArray(board.sectionOrder)) {
        console.warn(`Invalid or missing sectionOrder for board: ${board.id}`);
        board.sectionOrder = [];
    }
    
    // Render sections
    board.sectionOrder.forEach(sectionId => {
        if (!sectionId) {
            console.warn('Null or undefined section ID found in sectionOrder');
            return;
        }
        
        const section = state.sections?.[sectionId];
        if (!section) {
            console.warn(`Section ${sectionId} not found in state`);
            return;
        }

        const columnEl = renderColumn(section, state, elements);
        if (columnEl) {
            elements.columns.appendChild(columnEl);
        }
    });

    // Add the "Add Column" button
    const addColumnBtn = document.createElement('button');
    addColumnBtn.className = 'add-column-btn';
    addColumnBtn.setAttribute('aria-label', 'Add new column');
    addColumnBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addColumnBtn.addEventListener('click', () => window.addColumn(board.id));
    elements.columns.appendChild(addColumnBtn);
}

/**
 * Renders a single column (section)
 * @param {Object} section - Section data
 * @param {Object} state - Application state
 * @param {Object} elements - DOM elements
 * @returns {HTMLElement} The column element
 */
function renderColumn(section, state, elements) {
    if (!section) return null;

    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.sectionId = section.id;
    columnEl.draggable = false; // Column itself is not draggable

    // Add drag event listeners for tasks and sections
    columnEl.addEventListener('dragover', window.handleDragOver);
    columnEl.addEventListener('drop', window.handleDrop);
    columnEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (document.querySelector('.task.dragging')) {
            columnEl.classList.add('drag-over');
        }
    });
    columnEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!e.relatedTarget || !columnEl.contains(e.relatedTarget)) {
            columnEl.classList.remove('drag-over');
        }
    });

    // Ensure taskIds exists and is an array
    const taskIds = Array.isArray(section.taskIds) ? section.taskIds : [];
    const taskCount = taskIds.length;

    const headerEl = document.createElement('div');
    headerEl.className = 'column-header';
    headerEl.draggable = true; // Only the header is draggable
    headerEl.setAttribute('draggable', true);
    
    // Add touch support for mobile drag and drop
    headerEl.addEventListener('touchstart', function(e) {
        // Create a synthetic event with a minimal dataTransfer polyfill
        const syntheticEvent = {
            target: headerEl,
            dataTransfer: {
                setData: (type, val) => { headerEl.dataset.dragData = val; },
                effectAllowed: 'move'
            },
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            preventDefault: () => {}
        };
        // Invoke the existing drag start handler
        window.handleDragStart(syntheticEvent);
    });

    // Add touchmove listener to simulate dragover
    headerEl.addEventListener('touchmove', function(e) {
        e.preventDefault(); // Prevent scrolling while dragging
        const syntheticEvent = {
            target: e.target,
            touches: e.touches,
            preventDefault: () => {},
            dataTransfer: {
                effectAllowed: 'move'
            }
        };
        window.handleDragOver(syntheticEvent);
    });

    // Add touchend listener to simulate drop
    headerEl.addEventListener('touchend', function(e) {
        const touch = e.changedTouches[0];
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        if (dropTarget) {
            const syntheticEvent = {
                target: dropTarget,
                preventDefault: () => {},
                dataTransfer: {
                    getData: () => headerEl.dataset.dragData
                }
            };
            window.handleDrop(syntheticEvent);
        }
        // Clean up
        headerEl.classList.remove('dragging');
    });
    
    const columnTitle = document.createElement('h2');
    columnTitle.className = 'column-title';
    columnTitle.textContent = section.name || 'Unnamed Section';
    window.makeEditable(columnTitle, async (newName) => {
        try {
            const response = await fetch(`${window.appConfig.basePath}/api/boards/${state.activeBoard}/sections/${section.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
                
            if (response.ok) {
                const updatedSection = await response.json();
                state.sections[section.id] = updatedSection;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update section name:', error);
            return false;
        }
    }, state);
        
    headerEl.innerHTML = `
        <div class="column-count">${taskCount}</div>
        <div class="column-drag-handle">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
    `;
    headerEl.insertBefore(columnTitle, headerEl.lastElementChild);

    // Add drag event listeners to the header
    headerEl.addEventListener('dragstart', window.handleSectionDragStart);
    headerEl.addEventListener('dragend', () => columnEl.classList.remove('dragging'));

    columnEl.appendChild(headerEl);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'tasks';
    tasksContainer.dataset.sectionId = section.id;
    columnEl.appendChild(tasksContainer);

    // Render tasks
    taskIds.forEach(taskId => {
        const task = state.tasks?.[taskId];
        if (task) {
            const taskEl = renderTask(task, state);
            if (taskEl) {
                tasksContainer.appendChild(taskEl);
            }
        }
    });

    // Add task button
    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-task-btn';
    addTaskBtn.setAttribute('aria-label', 'Add task');
    addTaskBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addTaskBtn.addEventListener('click', () => {
        window.createInlineTaskEditor(section.id, addTaskBtn);
    });
    columnEl.appendChild(addTaskBtn);

    return columnEl;
}

/**
 * Renders a single task
 * @param {Object} task - Task data
 * @param {Object} state - Application state
 * @returns {HTMLElement} The task element
 */
function renderTask(task, state) {
    if (!task) return null;

    const taskElement = document.createElement('div');
    taskElement.className = 'task';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.sectionId = task.sectionId;
    taskElement.draggable = true;  // Make tasks draggable

    // Add drag handle with simpler icon
    const dragHandle = document.createElement('div');
    dragHandle.className = 'task-drag-handle';
    dragHandle.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    taskElement.appendChild(dragHandle);

    // Create main content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'task-content-wrapper';

    // Create task title
    const taskTitle = document.createElement('h3');
    taskTitle.className = 'task-title';
    const titleText = document.createElement('span');
    titleText.className = 'title-text';
    titleText.textContent = task.title || 'Untitled Task';
    window.makeEditable(titleText, async (newTitle) => {
        try {
            const updatedTask = await window.updateTask(task, { title: newTitle });
            if (updatedTask) {
                state.tasks[task.id] = updatedTask;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task title:', error);
            return false;
        }
    }, state);
    taskTitle.appendChild(titleText);
    contentWrapper.appendChild(taskTitle);

    // Create badges container
    const metadataBadges = document.createElement('div');
    metadataBadges.className = 'task-badges';

    // Add status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge status-badge ${task.status || 'active'}`;
    statusBadge.setAttribute('title', (task.status || 'active').charAt(0).toUpperCase() + (task.status || 'active').slice(1));
    statusBadge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newStatus = task.status === 'active' ? 'inactive' : 'active';
        try {
            const updatedTask = await window.updateTask(task, { status: newStatus });
            if (updatedTask) {
                state.tasks[task.id] = updatedTask;
                statusBadge.className = `badge status-badge ${newStatus}`;
                statusBadge.setAttribute('title', newStatus.charAt(0).toUpperCase() + newStatus.slice(1));
                task.status = newStatus;
            }
        } catch (error) {
            console.error('Failed to update task status:', error);
        }
    });
    metadataBadges.appendChild(statusBadge);

    // Add info badge
    const infoBadge = document.createElement('span');
    infoBadge.className = 'badge info-badge';
    infoBadge.textContent = 'i';
    infoBadge.setAttribute('title', 'View Task Details');
    infoBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        window.showTaskModal(task);
    });
    metadataBadges.appendChild(infoBadge);

    // Add priority badge
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge priority-badge ${task.priority}`;
    priorityBadge.setAttribute('title', task.priority.charAt(0).toUpperCase() + task.priority.slice(1));
    priorityBadge.textContent = window.getPrioritySymbol(task.priority);

    // Create priority tray
    const priorityTray = document.createElement('div');
    priorityTray.className = 'priority-tray';
    
    const priorities = [
        { name: 'low', symbol: '↓' },
        { name: 'medium', symbol: '-' },
        { name: 'high', symbol: '↑' },
        { name: 'urgent', symbol: '!' }
    ];
    
    priorities.forEach(priority => {
        const option = document.createElement('div');
        option.className = `priority-option ${priority.name}`;
        option.textContent = priority.symbol;
        option.setAttribute('title', priority.name.charAt(0).toUpperCase() + priority.name.slice(1));
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const updatedTask = await window.updateTask(task, { priority: priority.name });
                if (updatedTask) {
                    state.tasks[task.id] = updatedTask;
                    refreshBoard(state, window.elements);
                }
            } catch (error) {
                console.error('Failed to update task priority:', error);
            }
            priorityTray.classList.remove('active');
        });
        priorityTray.appendChild(option);
    });
    
    priorityBadge.appendChild(priorityTray);
    priorityBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        const allTrays = document.querySelectorAll('.priority-tray');
        allTrays.forEach(tray => {
            if (tray !== priorityTray) {
                tray.classList.remove('active');
            }
        });
        priorityTray.classList.toggle('active');
    });
    metadataBadges.appendChild(priorityBadge);

    // Add calendar badge
    const calendarBadge = document.createElement('div');
    calendarBadge.className = 'calendar-badge' + (task.dueDate ? ' has-due-date' : '');
    if (task.dueDate && window.isPastDue(task.dueDate)) {
        calendarBadge.classList.add('past-due');
    }

    // Create date input
    const dateInput = document.createElement('input');
    dateInput.type = 'text';
    dateInput.className = 'calendar-date-input';
    dateInput.placeholder = 'Enter due date';
    dateInput.hidden = true;
    if (task.dueDate) {
        dateInput.value = new Date(task.dueDate).toISOString().split('T')[0];
    }

    // Add focus handler to select all text
    dateInput.addEventListener('focus', (e) => {
        e.target.select();
    });

    // Create calendar icon
    const calendarIcon = document.createElement('div');
    calendarIcon.className = 'calendar-icon';
    calendarIcon.innerHTML = task.dueDate ? window.formatDueDate(task.dueDate) : '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 2v3M16 2v3M3.5 8h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Add elements to badge
    calendarBadge.appendChild(dateInput);
    calendarBadge.appendChild(calendarIcon);

    // Toggle input on icon click
    calendarIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        dateInput.hidden = !dateInput.hidden;
        if (!dateInput.hidden) {
            dateInput.focus();
        }
    });

    // Handle date saving
    const saveDueDate = async () => {
        const inputValue = dateInput.value.trim();
        let parsedDate = null;
        
        if (inputValue) {
            try {
                parsedDate = window.DumbDateParser.parseDate(inputValue);
                if (!parsedDate) return;
                
                // If no time specified, set to midnight
                if (!inputValue.toLowerCase().includes('@') && 
                    !inputValue.toLowerCase().includes('at') && 
                    !inputValue.toLowerCase().includes('am') && 
                    !inputValue.toLowerCase().includes('pm')) {
                    parsedDate.setHours(0, 0, 0, 0);
                }
            } catch (err) {
                console.error('Error parsing due date:', err);
                return;
            }
        }

        const updatedTask = await window.updateTask(task, { dueDate: parsedDate ? parsedDate.toISOString() : null });
        if (updatedTask) {
            // Update calendar badge display
            calendarIcon.innerHTML = updatedTask.dueDate ? window.formatDueDate(updatedTask.dueDate) : '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 2v3M16 2v3M3.5 8h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            calendarBadge.classList.toggle('has-due-date', !!parsedDate);
            calendarBadge.classList.toggle('past-due', parsedDate && window.isPastDue(parsedDate));
        }
        dateInput.hidden = true;
    };

    // Handle input blur
    dateInput.addEventListener('blur', saveDueDate);

    // Handle Enter and Escape keys
    dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveDueDate();
        } else if (e.key === 'Escape') {
            dateInput.hidden = true;
        }
    });

    metadataBadges.appendChild(calendarBadge);

    // Add badges to content wrapper
    contentWrapper.appendChild(metadataBadges);

    // Add description or arrow hook
    if (task.description) {
        const taskDescription = document.createElement('div');
        taskDescription.className = 'task-description';
        taskDescription.innerHTML = window.linkify(task.description);
        window.makeEditable(taskDescription, async (newDescription) => {
            try {
                const updatedTask = await window.updateTask(task, { description: newDescription });
                if (updatedTask) {
                    state.tasks[task.id] = updatedTask;
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to update task description:', error);
                return false;
            }
        }, state);
        contentWrapper.appendChild(taskDescription);
    } else {
        const descriptionHook = document.createElement('div');
        descriptionHook.className = 'description-hook';
        descriptionHook.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;
        descriptionHook.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskDescription = document.createElement('div');
            taskDescription.className = 'task-description';
            const textarea = document.createElement('textarea');
            textarea.className = 'inline-edit';
            textarea.placeholder = 'Add a description...';
            
            const saveDescription = async () => {
                const newDescription = textarea.value.trim();
                try {
                    const updatedTask = await window.updateTask(task, { description: newDescription });
                    if (updatedTask) {
                        state.tasks[task.id] = updatedTask;
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error('Failed to add task description:', error);
                    return false;
                }
            };

            textarea.addEventListener('blur', saveDescription);
            textarea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    textarea.blur();
                } else if (e.key === 'Escape') {
                    refreshBoard(state, window.elements);
                }
            });

            taskDescription.appendChild(textarea);
            contentWrapper.appendChild(taskDescription);
            textarea.focus();
        });
        contentWrapper.appendChild(descriptionHook);
    }

    taskElement.appendChild(contentWrapper);

    // Add move right button
    const moveRightBtn = document.createElement('button');
    moveRightBtn.className = 'task-move';
    moveRightBtn.setAttribute('aria-label', 'Move task right');
    moveRightBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    `;
    moveRightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.moveTaskRight(task.id, task.sectionId);
    });

    // Only show the move right button if there's a section to the right
    const board = state.boards[state.activeBoard];
    if (board && board.sectionOrder) {
        const currentSectionIndex = board.sectionOrder.indexOf(task.sectionId);
        if (currentSectionIndex === -1 || currentSectionIndex >= board.sectionOrder.length - 1) {
            moveRightBtn.style.visibility = 'hidden';
        }
    }

    taskElement.appendChild(moveRightBtn);

    // Add event listeners
    taskElement.addEventListener('dragstart', window.handleDragStart);
    taskElement.addEventListener('dragend', window.handleDragEnd);
    taskElement.addEventListener('touchstart', window.handleTouchStart, { passive: false });
    taskElement.addEventListener('touchmove', window.handleTouchMove, { passive: false });
    taskElement.addEventListener('touchend', window.handleTouchEnd, { passive: false });

    return taskElement;
}

/**
 * Refreshes the current board view
 * This is a convenience function that calls both renderBoards and renderActiveBoard
 * @param {Object} state - Application state
 * @param {Object} elements - DOM elements
 */
function refreshBoard(state, elements) {
    try {
        console.log('refreshBoard called with state:', {
            hasActiveBoard: !!state.activeBoard,
            activeBoardId: state.activeBoard,
            totalBoards: state.boards ? Object.keys(state.boards).length : 0,
            totalTasks: state.tasks ? Object.keys(state.tasks).length : 0
        });
        
        // Ensure state is properly defined
        if (!state) {
            console.error('Cannot refresh board: state is undefined');
            return;
        }
        
        // Ensure required properties exist
        if (!state.boards) {
            console.error('Cannot refresh board: state.boards is undefined');
            return;
        }
        
        // Make sure we have an activeBoard
        if (!state.activeBoard) {
            // Try to set an active board if possible
            const boardIds = Object.keys(state.boards);
            if (boardIds.length > 0) {
                state.activeBoard = boardIds[0];
                console.log('No active board set, defaulting to:', state.activeBoard);
            } else {
                console.error('Cannot refresh board: no boards available');
                return;
            }
        }
        
        renderBoards(state, elements);
        renderActiveBoard(state, elements);
        
        console.log('Board refresh completed successfully');
    } catch (error) {
        console.error('Error in refreshBoard:', error);
    }
} 