// UI Utility Functions

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('error-container') || createErrorContainer();
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

// Create error container if it doesn't exist
function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'error-message';
    document.body.appendChild(container);
    return container;
}

// Add error message styles
const style = document.createElement('style');
style.textContent = `
.error-message {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #ff4444;
    color: white;
    padding: 15px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 1000;
    display: none;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
`;
document.head.appendChild(style);

// Expose functions globally
window.showError = showError;
window.createErrorContainer = createErrorContainer; 