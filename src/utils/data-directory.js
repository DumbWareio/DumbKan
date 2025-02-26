/**
 * Data Directory Utility
 * Handles creation and management of the data directories
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// List of possible legacy data directories (ordered by priority)
const legacyDataPaths = [
    path.join(process.cwd(), 'app', 'data'),
    path.join(process.cwd(), 'data'),
    path.join('/app', 'data') // For Docker environments
];

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

/**
 * Checks if any of the legacy data directories exist
 * @returns {Promise<string|null>} Path to the first found legacy directory, or null if none exist
 */
async function findLegacyDataDirectory() {
    // Check each potential legacy path
    for (const dirPath of legacyDataPaths) {
        try {
            const stats = await fs.stat(dirPath);
            if (stats.isDirectory()) {
                return dirPath;
            }
        } catch (error) {
            // Directory doesn't exist, continue to next one
            continue;
        }
    }
    
    // No legacy directory found
    return null;
}

module.exports = ensureDataDirectory;
module.exports.findLegacyDataDirectory = findLegacyDataDirectory; 