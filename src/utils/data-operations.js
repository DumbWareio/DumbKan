const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const ensureDataDirectory = require('./data-directory');

// Simple ID generator
function generateId() {
    return Math.random().toString(36).slice(2, 11); // 9 chars
}

// Helper functions all use the same simple ID generator
function generateTaskId() {
    return generateId();
}

function generateSectionId() {
    return generateId();
}

function generateBoardId() {
    return generateId();
}

function generateUniqueSectionId() {
    return generateId();
}

// Helper function to write data
async function writeData(data) {
    await ensureDataDirectory();
    await fs.writeFile(config.DATA_FILE, JSON.stringify(data, null, 2));
}

// Check if data is in the old format
function isOldFormat(data) {
    // Check for presence of boards with 'columns' property (old format)
    if (!data || !data.boards) return false;
    
    // Get a sample board
    const boardKey = Object.keys(data.boards)[0];
    if (!boardKey) return false;
    
    // Check if it has the old 'columns' structure
    return !!data.boards[boardKey].columns;
}

// Helper function to read data
async function readData() {
    await ensureDataDirectory();
    try {
        const data = await fs.readFile(config.DATA_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        
        // Check if this is old format data that somehow wasn't migrated
        if (isOldFormat(parsedData)) {
            console.warn('WARNING: Found data in old format. This should have been migrated during startup.');
            console.warn('Loading data in current format, but migration should be performed.');
            
            // Continue with the data as-is, but log a warning
            // The proper migration will happen on next server start
        }
        
        return parsedData;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create default data structure if file doesn't exist
            const boardId = generateBoardId();
            const todoId = generateSectionId();
            const doingId = generateSectionId();
            const doneId = generateSectionId();
            
            const defaultData = {
                boards: {
                    [boardId]: {
                        id: boardId,
                        name: "Personal",
                        sectionOrder: [todoId, doingId, doneId]
                    }
                },
                sections: {
                    [todoId]: {
                        id: todoId,
                        name: "To Do",
                        boardId: boardId,
                        taskIds: []
                    },
                    [doingId]: {
                        id: doingId,
                        name: "Doing",
                        boardId: boardId,
                        taskIds: []
                    },
                    [doneId]: {
                        id: doneId,
                        name: "Done",
                        boardId: boardId,
                        taskIds: []
                    }
                },
                tasks: {},
                activeBoard: boardId
            };

            // Write the default data to file
            await writeData(defaultData);
            return defaultData;
        }
        throw error;
    }
}

module.exports = {
    readData,
    writeData,
    generateTaskId,
    generateSectionId,
    generateBoardId,
    generateUniqueSectionId,
    isOldFormat
}; 