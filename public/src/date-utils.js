/**
 * Utility functions for date formatting and manipulation
 * Provides consistent date handling across the application
 * @module date-utils
 */

// Check if DumbDateParser is available
console.log('date-utils.js: DumbDateParser available:', window.DumbDateParser ? true : false);

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

/**
 * Creates a date object with time set to midnight
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @param {number} day - The day (1-31)
 * @returns {Date} A date object set to midnight on the specified date
 */
function createDateAtMidnight(year, month, day) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Get the month name from month number
 * @param {number} month - Month number (0-11)
 * @returns {string} Month name
 */
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
}

/**
 * Generate calendar data for a specific month
 * @param {Date} date - Date object containing the month to generate
 * @param {Date|null} selectedDate - Currently selected date (if any)
 * @returns {Array} Calendar data for rendering
 */
function generateCalendarData(date, selectedDate) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const firstDayIndex = firstDay.getDay();
    
    // Calculate days from previous month to include
    const prevMonthDays = [];
    if (firstDayIndex > 0) {
        const prevMonth = new Date(year, month, 0);
        const prevMonthLastDay = prevMonth.getDate();
        
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const prevMonthYear = month === 0 ? year - 1 : year;
            const prevMonthNum = month === 0 ? 11 : month - 1;
            
            prevMonthDays.push({
                day,
                month: prevMonthNum,
                year: prevMonthYear,
                isCurrentMonth: false,
                date: createDateAtMidnight(prevMonthYear, prevMonthNum, day)
            });
        }
    }
    
    // Current month days
    const currentMonthDays = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
        currentMonthDays.push({
            day,
            month,
            year,
            isCurrentMonth: true,
            date: createDateAtMidnight(year, month, day)
        });
    }
    
    // Next month days to fill the last row
    const nextMonthDays = [];
    const totalDaysSoFar = prevMonthDays.length + currentMonthDays.length;
    const nextDaysNeeded = 42 - totalDaysSoFar; // 6 rows × 7 days = 42
    
    for (let day = 1; day <= nextDaysNeeded; day++) {
        const nextMonthYear = month === 11 ? year + 1 : year;
        const nextMonthNum = month === 11 ? 0 : month + 1;
        
        nextMonthDays.push({
            day,
            month: nextMonthNum,
            year: nextMonthYear,
            isCurrentMonth: false,
            date: createDateAtMidnight(nextMonthYear, nextMonthNum, day)
        });
    }
    
    // Combine all days
    const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
    
    // Mark today and selected date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allDays.map(day => {
        const isToday = day.date.getTime() === today.getTime();
        const isSelected = selectedDate && day.date.getTime() === selectedDate.getTime();
        
        return {
            ...day,
            isToday,
            isSelected
        };
    });
}

/**
 * Render calendar into a container element
 * @param {HTMLElement} container - Container element for the calendar
 * @param {Date} currentMonth - The month to display
 * @param {Date|null} selectedDate - Currently selected date (if any)
 * @param {Function} onDateSelect - Callback for date selection
 */
function renderCalendar(container, currentMonth, selectedDate, onDateSelect) {
    // Clear container
    container.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'calendar-header';
    
    // Previous month button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'calendar-nav';
    prevBtn.innerHTML = '&lt;';
    prevBtn.setAttribute('aria-label', 'Previous month');
    
    // Month and year display
    const monthYearDisplay = document.createElement('div');
    monthYearDisplay.className = 'calendar-month-year';
    monthYearDisplay.textContent = `${getMonthName(currentMonth.getMonth())} ${currentMonth.getFullYear()}`;
    
    // Next month button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'calendar-nav';
    nextBtn.innerHTML = '&gt;';
    nextBtn.setAttribute('aria-label', 'Next month');
    
    // Assemble header
    header.appendChild(prevBtn);
    header.appendChild(monthYearDisplay);
    header.appendChild(nextBtn);
    
    // Create calendar grid
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    // Add day headers
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-weekday';
        dayHeader.textContent = day;
        grid.appendChild(dayHeader);
    });
    
    // Generate and add calendar days
    const calendarData = generateCalendarData(currentMonth, selectedDate);
    calendarData.forEach(dayData => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayData.day;
        
        if (!dayData.isCurrentMonth) {
            dayElement.classList.add('other-month');
        }
        
        if (dayData.isToday) {
            dayElement.classList.add('today');
        }
        
        if (dayData.isSelected) {
            dayElement.classList.add('selected');
        }
        
        // Set date as data attribute for easy access
        dayElement.dataset.date = dayData.date.toISOString();
        
        // Add click event
        dayElement.addEventListener('click', (e) => {
            // For day clicks, we generally want the calendar to close, but still prevent propagation
            e.stopPropagation();
            
            if (typeof onDateSelect === 'function') {
                onDateSelect(dayData.date, true); // true = close calendar
            }
        });
        
        grid.appendChild(dayElement);
    });
    
    // Create footer with Today and Clear buttons
    const footer = document.createElement('div');
    footer.className = 'calendar-footer';
    
    const todayButton = document.createElement('button');
    todayButton.className = 'calendar-button';
    todayButton.textContent = 'Today';
    todayButton.addEventListener('click', (e) => {
        // Prevent event propagation to stop the calendar from closing
        e.preventDefault();
        e.stopPropagation();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (typeof onDateSelect === 'function') {
            onDateSelect(today, false); // false = keep calendar open
            // Re-render calendar with today as selected date
            renderCalendar(container, today, today, onDateSelect);
        }
    });
    
    const clearButton = document.createElement('button');
    clearButton.className = 'calendar-button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', (e) => {
        // Prevent event propagation to stop the calendar from closing
        e.preventDefault();
        e.stopPropagation();
        
        if (typeof onDateSelect === 'function') {
            onDateSelect(null, false); // false = keep calendar open
            // Re-render calendar with no selected date
            renderCalendar(container, currentMonth, null, onDateSelect);
        }
    });
    
    footer.appendChild(todayButton);
    footer.appendChild(clearButton);
    
    // Add month navigation functionality
    prevBtn.addEventListener('click', (e) => {
        // Prevent event propagation to stop the calendar from closing
        e.preventDefault();
        e.stopPropagation();
        
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() - 1);
        renderCalendar(container, newMonth, selectedDate, onDateSelect);
    });
    
    nextBtn.addEventListener('click', (e) => {
        // Prevent event propagation to stop the calendar from closing
        e.preventDefault();
        e.stopPropagation();
        
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() + 1);
        renderCalendar(container, newMonth, selectedDate, onDateSelect);
    });
    
    // Assemble calendar
    container.appendChild(header);
    container.appendChild(grid);
    container.appendChild(footer);
}

/**
 * Initialize calendar date pickers for task date inputs
 * Sets up event listeners and manages calendar popup state
 */
function initTaskDatePickers() {
    console.log('Initializing task date pickers');
    
    // Get all calendar trigger buttons
    const calendarTriggers = document.querySelectorAll('.calendar-trigger');
    console.log('Found calendar triggers:', calendarTriggers.length);
    
    // Track open calendar popup
    let openCalendarPopup = null;
    
    calendarTriggers.forEach(trigger => {
        const targetInputId = trigger.getAttribute('data-for');
        const targetInput = document.getElementById(targetInputId);
        const calendarPopup = trigger.nextElementSibling;
        
        console.log('Calendar trigger setup:', {
            targetInputId,
            targetInputExists: !!targetInput,
            calendarPopupExists: !!calendarPopup
        });
        
        if (!targetInput || !calendarPopup) return;
        
        // Add click handler to calendar popup to prevent event propagation
        calendarPopup.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Remove any existing click listeners to prevent duplicates
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        // Setup trigger click handler
        newTrigger.addEventListener('click', function(e) {
            console.log('Calendar trigger clicked for:', targetInputId);
            e.preventDefault();
            e.stopPropagation();
            
            // Force close any open calendar
            document.querySelectorAll('.calendar-popup').forEach(popup => {
                if (popup !== calendarPopup) {
                    popup.classList.remove('open');
                }
            });
            
            // Toggle this calendar
            const isOpen = calendarPopup.classList.contains('open');
            calendarPopup.classList.toggle('open');
            console.log('Calendar open state:', !isOpen);
            
            // If opening, render the calendar
            if (!isOpen) {
                // Get currently selected date from input (if any)
                let selectedDate = null;
                if (targetInput.value) {
                    try {
                        // Try to parse the input value
                        if (window.DumbDateParser) {
                            console.log('Using DumbDateParser to parse:', targetInput.value);
                            selectedDate = window.DumbDateParser.parseDate(targetInput.value);
                        } else {
                            // Fallback to simple date parsing
                            console.log('Using native Date parsing for:', targetInput.value);
                            selectedDate = new Date(targetInput.value);
                            if (isNaN(selectedDate.getTime())) {
                                selectedDate = null;
                            }
                        }
                        console.log('Parsed date:', selectedDate);
                    } catch (e) {
                        console.warn('Failed to parse date from input', e);
                        selectedDate = null;
                    }
                }
                
                // Determine which month to show
                const displayMonth = selectedDate ? new Date(selectedDate) : new Date();
                console.log('Rendering calendar for month:', displayMonth);
                
                // Clear the popup and render the calendar
                calendarPopup.innerHTML = '';
                renderCalendar(calendarPopup, displayMonth, selectedDate, (date, shouldClose = true) => {
                    console.log('Date selected:', date, 'Should close:', shouldClose);
                    if (date) {
                        // Format the date as YYYY-MM-DD for the input
                        const formattedDate = date.toISOString().split('T')[0];
                        targetInput.value = formattedDate;
                        
                        // Store raw date in dataset for reference
                        targetInput.dataset.originalDate = date.toISOString();
                    } else {
                        // Clear the input
                        targetInput.value = '';
                        delete targetInput.dataset.originalDate;
                    }
                    
                    // Close the calendar popup only if shouldClose is true
                    if (shouldClose) {
                        calendarPopup.classList.remove('open');
                    }
                    
                    // Trigger change event on the input
                    const changeEvent = new Event('change', { bubbles: true });
                    targetInput.dispatchEvent(changeEvent);
                    
                    // Also trigger blur to handle any blur event handlers
                    const blurEvent = new Event('blur', { bubbles: true });
                    targetInput.dispatchEvent(blurEvent);
                });
            }
        });
    });
    
    // Close calendar when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.calendar-popup') && !e.target.closest('.calendar-trigger')) {
            document.querySelectorAll('.calendar-popup.open').forEach(popup => {
                popup.classList.remove('open');
            });
        }
    });
}

// Expose functions globally
window.formatDateHumanReadable = formatDateHumanReadable;
window.formatDueDate = formatDueDate;
window.isPastDue = isPastDue;
window.initTaskDatePickers = initTaskDatePickers; 