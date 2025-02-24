// Module Loader to bridge module and non-module environments
(function() {
    console.log('[Module Loader] Starting initialization');
    console.log('[Module Loader] Current script:', document.currentScript?.src);
    
    // Theme Management
    function initTheme() {
        console.log('[Module Loader] initTheme called');
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
        console.log('[Module Loader] toggleTheme called');
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    // Expose functions to global scope
    window.initTheme = initTheme;
    window.toggleTheme = toggleTheme;
    
    console.log('[Module Loader] Functions exposed to window:', {
        initThemeExists: typeof window.initTheme === 'function',
        toggleThemeExists: typeof window.toggleTheme === 'function',
        windowKeys: Object.keys(window).filter(k => k === 'initTheme' || k === 'toggleTheme')
    });
})(); 