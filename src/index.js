/**
 * Main application entry point
 * Initializes and starts the server with all required modules
 */

require('dotenv').config();
const config = require('./config');
const app = require('./server');
const { migrateOldData } = require('./utils/migrate-data');

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Run migration before starting the server
async function startServer() {
    try {
        // Check for and migrate old data if found
        const migrationPerformed = await migrateOldData();
        if (migrationPerformed) {
            console.log('Successfully migrated data from old format to new format');
        }
        
        // Start the server
        app.listen(config.PORT, () => {
            debugLog('Server Configuration:', {
                port: config.PORT,
                basePath: config.BASE_PATH,
                pinProtection: !!config.PIN,
                nodeEnv: config.NODE_ENV || 'development',
                debug: config.DEBUG,
                dataMigration: migrationPerformed ? 'completed' : 'not needed'
            });
            console.log(`Server running on port ${config.PORT}`);
            console.log(`Site title set to: ${config.SITE_TITLE}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer(); 