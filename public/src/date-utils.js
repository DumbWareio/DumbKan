/**
 * Utility functions for date formatting and manipulation
 * Provides consistent date handling across the application
 * @module date-utils
 */

/**
 * Formats a date string into a human-readable format
 * @param {string} dateStr - ISO date string to format
 * @returns {string} Human readable date string
 */
function formatDateHumanReadable(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Reset time parts for today/tomorrow comparison
    const dateNoTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowNoTime = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    // Check if time is midnight (00:00)
    const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
    
    // Only add time if it's not midnight
    const timeStr = isMidnight ? '' : ` @ ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    })}`;
    
    if (dateNoTime.getTime() === todayNoTime.getTime()) {
        return `Today${timeStr}`;
    } else if (dateNoTime.getTime() === tomorrowNoTime.getTime()) {
        return `Tomorrow${timeStr}`;
    } else {
        // Format as YYYY-MM-DD
        const dateStr = date.toISOString().split('T')[0];
        return `${dateStr}${timeStr}`;
    }
}

/**
 * Formats a date string into a simplified display format (Today, Tomorrow, or YYYY-MM-DD)
 * @param {string} dateStr - ISO date string to format
 * @returns {string} Simplified date string
 */
function formatDueDate(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Reset time parts for comparison
    const dateNoTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowNoTime = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (dateNoTime.getTime() === todayNoTime.getTime()) {
        return 'Today';
    } else if (dateNoTime.getTime() === tomorrowNoTime.getTime()) {
        return 'Tomorrow';
    } else {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
}

/**
 * Checks if a given date is in the past
 * @param {string} dateStr - ISO date string to check
 * @returns {boolean} True if the date is in the past, false otherwise
 */
function isPastDue(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    
    // Reset time parts for comparison
    const dateNoTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return dateNoTime < todayNoTime;
}

// Expose functions globally
window.formatDateHumanReadable = formatDateHumanReadable;
window.formatDueDate = formatDueDate;
window.isPastDue = isPastDue; 