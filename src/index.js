/**
 * Main application entry point
 * Initializes and starts the server with all required modules
 */

require('dotenv').config();
const config = require('./config');
const app = require('./server');

function debugLog(...args) {
    if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

app.listen(config.PORT, () => {
    debugLog('Server Configuration:', {
        port: config.PORT,
        basePath: config.BASE_PATH,
        pinProtection: !!config.PIN,
        nodeEnv: config.NODE_ENV || 'development',
        debug: config.DEBUG
    });
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Site title set to: ${config.SITE_TITLE}`);
}); 