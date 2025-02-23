const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

/**
 * Ensures the data directory exists, creating it if necessary
 * @returns {Promise<void>}
 */
async function ensureDataDirectory() {
    const dir = path.dirname(config.DATA_FILE);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

module.exports = ensureDataDirectory; 