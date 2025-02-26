/**
 * Data Migration Test Script
 * Tests the migration of old data structure to new format
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { migrateData, isOldFormat } = require('../src/utils/migrate-data');

// Sample old data structure for testing
const oldData = {
    boards: {
        work: {
            name: "Work",
            columns: {
                todo: {
                    name: "To Do",
                    tasks: [
                        {
                            title: "Sample Task 1",
                            description: "This is a sample task",
                            status: "active"
                        },
                        {
                            title: "Sample Task 2",
                            description: "Another sample task",
                            status: "active"
                        }
                    ]
                },
                doing: {
                    name: "Doing",
                    tasks: [
                        {
                            title: "In Progress Task",
                            description: "This task is in progress",
                            status: "active"
                        }
                    ]
                },
                done: {
                    name: "Done",
                    tasks: []
                }
            }
        },
        personal: {
            name: "Personal",
            columns: {
                "column-1737820503477": {
                    name: "To Do",
                    tasks: [
                        {
                            title: "Personal Task",
                            description: "A personal task",
                            status: "active"
                        }
                    ]
                },
                "column-1737820504596": {
                    name: "Doing",
                    tasks: []
                },
                "column-1737820919397": {
                    name: "Done",
                    tasks: []
                }
            }
        }
    },
    activeBoard: "personal"
};

async function runTest() {
    console.log('Testing data migration utility...');
    
    // Verify the isOldFormat function recognizes the old data
    const isOld = isOldFormat(oldData);
    console.log('Is data in old format?', isOld);
    
    if (!isOld) {
        console.error('ERROR: Old data format not recognized!');
        return;
    }
    
    // Perform the migration
    console.log('Migrating sample data...');
    const newData = migrateData(oldData);
    
    // Output the results
    console.log('\nMigration Results:');
    console.log('------------------');
    console.log('Boards:', Object.keys(newData.boards).length);
    console.log('Sections:', Object.keys(newData.sections).length);
    console.log('Tasks:', Object.keys(newData.tasks).length);
    console.log('Active Board:', newData.activeBoard);
    
    // Verify structure
    console.log('\nVerifying new data structure...');
    const validStructure = 
        newData.boards && 
        newData.sections && 
        newData.tasks && 
        typeof newData.activeBoard !== 'undefined';
    
    if (validStructure) {
        console.log('✅ Data structure is valid');
        
        // Save the result to a test file for inspection
        const testOutput = path.join(__dirname, 'migration-test-output.json');
        await fs.writeFile(testOutput, JSON.stringify(newData, null, 2));
        console.log(`\nMigrated data saved to ${testOutput} for inspection`);
    } else {
        console.error('❌ Data structure is invalid');
    }
}

// Run the test
runTest().catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
}); 