// Module Loader to bridge module and non-module environments
(function() {
    console.log('[Module Loader] Starting initialization');
    console.log('[Module Loader] Current script:', document.currentScript?.src);
    
    // Theme Management functions have been moved to /public/src/theme.js
    // Keeping this comment to track the function's new location
    
    console.log('[Module Loader] Functions exposed to window:', {
        initThemeExists: typeof window.initTheme === 'function',
        toggleThemeExists: typeof window.toggleTheme === 'function',
        windowKeys: Object.keys(window).filter(k => k === 'initTheme' || k === 'toggleTheme')
    });
})(); 