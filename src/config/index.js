/**
 * Application configuration and constants
 * Centralizes all configuration values and environment variables
 */

const path = require('path');
const BASE_PATH = require('./base-path');

// Project name constant
const projectName = 'DumbKan';

// Environment variables
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DUMBKAN_DEBUG === 'true' || process.env.DEBUG === 'TRUE';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Change from dynamic PIN env var to hardcoded one
const PIN = process.env.DUMBKAN_PIN;

// API secret for external service authorization
const DUMB_SECRET = process.env.DUMB_SECRET;

// Get site title from environment variable or use default
const SITE_TITLE = process.env.SITE_TITLE || 'DumbKan';

// Authentication constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

// Data file configuration - use absolute path for Docker environment and relative path for development
const DATA_FILE = NODE_ENV === 'production' 
    ? '/app/dumbdata/tasks.json'
    : path.join(process.cwd(), 'dumbdata', 'tasks.json');

// Public directory path
const PUBLIC_DIR = path.join(__dirname, '../../public');

console.log('Loading environment configuration:', {
    PORT,
    DEBUG,
    NODE_ENV,
    PIN_ENV_VAR: 'DUMBKAN_PIN',
    PIN_SET: !!process.env.DUMBKAN_PIN,
    PIN_VALUE: process.env.DUMBKAN_PIN ? 'SET' : 'NOT SET',
    DUMB_SECRET_SET: !!process.env.DUMB_SECRET,
    SITE_TITLE,
    BASE_PATH
});

module.exports = {
    PORT,
    DEBUG,
    NODE_ENV,
    PIN,
    DUMB_SECRET,
    SITE_TITLE,
    BASE_PATH,
    MAX_ATTEMPTS,
    LOCKOUT_TIME,
    DATA_FILE,
    PUBLIC_DIR,
    projectName
}; 