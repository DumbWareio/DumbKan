/**
 * Theme management module for handling light/dark theme switching and persistence
 */

// Theme Management
function initTheme() {
    console.log('[Theme] initTheme called');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
}

function toggleTheme() {
    console.log('[Theme] toggleTheme called');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Export functions to window object for non-module access
window.initTheme = initTheme;
window.toggleTheme = toggleTheme; 