/**
 * Element initialization module
 * Provides functionality to initialize and validate DOM elements
 * Used to ensure all required UI elements are available before app initialization
 */

/**
 * Initializes and validates DOM elements required by the application
 * @returns {Object} Object containing references to all required DOM elements
 * @throws {Error} If any required element is not found in the DOM
 */
export function initElements() {
    console.log('Initializing DOM elements');
    
    // Initialize DOM elements
    const elements = {
        themeToggle: document.getElementById('themeToggle'),
        boardMenu: document.getElementById('boardMenu'),
        boardMenuBtn: document.getElementById('boardMenuBtn'),
        boardList: document.getElementById('boardList'),
        addBoardBtn: document.getElementById('addBoardBtn'),
        currentBoard: document.getElementById('currentBoard'),
        columns: document.getElementById('columns'),
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        taskTitle: document.getElementById('taskTitle'),
        taskTitleDisplay: document.getElementById('taskTitleDisplay'),
        taskTitleHidden: document.getElementById('taskTitleHidden'),
        taskDescription: document.getElementById('taskDescription'),
        taskStatus: document.getElementById('taskStatus'),
        taskDueDate: document.getElementById('taskDueDate'),
        taskStartDate: document.getElementById('taskStartDate'),
        boardContainer: document.querySelector('.board-container'),
        deleteTaskBtn: document.querySelector('#taskModal .btn-delete')
    };

    // Check required elements
    const requiredElements = [
        'themeToggle', 'boardMenu', 'boardMenuBtn', 'boardList', 
        'addBoardBtn', 'currentBoard', 'columns', 'boardContainer',
        'taskModal', 'taskForm', 'taskTitle', 'taskTitleDisplay',
        'taskDescription', 'taskStatus', 'taskDueDate', 'taskStartDate'
    ];

    for (const key of requiredElements) {
        if (!elements[key]) {
            console.error(`Required element "${key}" not found`);
            throw new Error(`Required element "${key}" not found`);
        }
    }
    
    return elements;
} 