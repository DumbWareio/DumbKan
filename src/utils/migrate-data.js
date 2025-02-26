/**
 * Data Migration Utility
 * Handles migration from old data structure to new normalized format
 * Used when upgrading from previous versions of the application
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const ensureDataDirectory = require('./data-directory');
const { findLegacyDataDirectory } = require('./data-directory');
const { generateTaskId, generateSectionId, generateBoardId } = require('./data-operations');

/**
 * Checks if a data object uses the old format
 * @param {Object} data - The data object to check
 * @returns {boolean} - True if the data is in the old format, false otherwise
 */
function isOldFormat(data) {
    // Check for presence of boards with 'columns' property (old format)
    if (!data || !data.boards) return false;
    
    // Get a sample board
    const boardKey = Object.keys(data.boards)[0];
    if (!boardKey) return false;
    
    // Check if it has the old 'columns' structure
    return !!data.boards[boardKey].columns;
}

/**
 * Migrates data from old to new format
 * @param {Object} oldData - Data in the old format
 * @returns {Object} - Data in the new format
 */
function migrateData(oldData) {
    console.log('Migrating data from old format to new format...');
    
    const newData = {
        boards: {},
        sections: {},
        tasks: {},
        activeBoard: oldData.activeBoard || null
    };
    
    // Migrate each board
    Object.entries(oldData.boards).forEach(([oldBoardId, oldBoard]) => {
        // Generate a new ID for this board or use the old ID if it's already in the right format
        const newBoardId = oldBoardId.length === 9 ? oldBoardId : generateBoardId();
        
        // Create an array to store section IDs in order
        const sectionOrder = [];
        
        // Process each column in the old board
        Object.entries(oldBoard.columns).forEach(([oldColumnId, oldColumn]) => {
            // Generate a new section ID
            const sectionId = generateSectionId();
            sectionOrder.push(sectionId);
            
            // Create a new section object
            newData.sections[sectionId] = {
                id: sectionId,
                name: oldColumn.name,
                boardId: newBoardId,
                taskIds: []
            };
            
            // Process tasks within this column
            if (Array.isArray(oldColumn.tasks)) {
                oldColumn.tasks.forEach(oldTask => {
                    // Generate a new task ID
                    const taskId = generateTaskId();
                    
                    // Store the task ID in the section
                    newData.sections[sectionId].taskIds.push(taskId);
                    
                    // Create a new task object with defaults for new fields
                    const now = new Date().toISOString();
                    newData.tasks[taskId] = {
                        id: taskId,
                        title: oldTask.title || 'Untitled Task',
                        description: oldTask.description || '',
                        createdAt: oldTask.createdAt || now,
                        updatedAt: oldTask.updatedAt || now,
                        sectionId: sectionId,
                        boardId: newBoardId,
                        priority: oldTask.priority || 'medium',
                        status: oldTask.status || 'active',
                        tags: oldTask.tags || [],
                        assignee: oldTask.assignee || null,
                        dueDate: oldTask.dueDate || null,
                        startDate: oldTask.startDate || null
                    };
                });
            }
        });
        
        // Create the new board object
        newData.boards[newBoardId] = {
            id: newBoardId,
            name: oldBoard.name,
            sectionOrder: sectionOrder
        };
        
        // Update active board reference if needed
        if (oldData.activeBoard === oldBoardId) {
            newData.activeBoard = newBoardId;
        }
    });
    
    console.log('Data migration complete. New structure:', {
        boards: Object.keys(newData.boards).length,
        sections: Object.keys(newData.sections).length,
        tasks: Object.keys(newData.tasks).length
    });
    
    return newData;
}

/**
 * Searches for old data files in legacy locations
 * @returns {Promise<string|null>} - Path to the first found old data file, or null if none found
 */
async function findOldDataFile() {
    // Find legacy data directory
    const legacyDir = await findLegacyDataDirectory();
    if (!legacyDir) {
        return null;
    }
    
    // Check for tasks.json in the legacy directory
    const oldDataPath = path.join(legacyDir, 'tasks.json');
    try {
        await fs.access(oldDataPath);
        return oldDataPath;
    } catch (error) {
        return null;
    }
}

/**
 * Checks for old data at legacy locations and migrates it if found
 * @returns {Promise<boolean>} - True if data was migrated, false if no old data was found
 */
async function migrateOldData() {
    try {
        // Find old data file
        const oldDataPath = await findOldDataFile();
        if (!oldDataPath) {
            console.log('No old data file found in legacy locations');
            return false;
        }
        
        // Read old data
        console.log('Found old data file at:', oldDataPath);
        const oldDataRaw = await fs.readFile(oldDataPath, 'utf8');
        const oldData = JSON.parse(oldDataRaw);
        
        // Check if it's actually in the old format
        if (!isOldFormat(oldData)) {
            console.log('Data appears to already be in the new format.');
            return false;
        }
        
        // Migrate to new format
        const newData = migrateData(oldData);
        
        // Ensure the new data directory exists
        await ensureDataDirectory();
        
        // Write the migrated data to the new location
        await fs.writeFile(config.DATA_FILE, JSON.stringify(newData, null, 2));
        console.log('Migrated data saved to:', config.DATA_FILE);
        
        // Create a backup of the old data
        const backupPath = `${oldDataPath}.backup-${Date.now()}`;
        await fs.copyFile(oldDataPath, backupPath);
        console.log('Created backup of old data at:', backupPath);
        
        return true;
    } catch (error) {
        console.error('Error during data migration:', error);
        throw error;
    }
}

module.exports = {
    migrateOldData,
    isOldFormat,
    migrateData
}; 