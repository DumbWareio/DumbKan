require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();

// Brute force protection setup
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const loginAttempts = new Map();

// Reset attempts for an IP
function resetAttempts(ip) {
    loginAttempts.delete(ip);
}

// Check if an IP is locked out
function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    // If enough time has passed, reset attempts
    if (Date.now() - attempts.lastAttempt >= LOCKOUT_TIME) {
        resetAttempts(ip);
        return false;
    }
    
    return attempts.count >= MAX_ATTEMPTS;
}

// Record a failed attempt for an IP
function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
}

// Clean up old lockouts periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
            loginAttempts.delete(ip);
        }
    }
}, LOCKOUT_TIME);

app.use(express.json());
app.use(cookieParser());

// Ensure data directory and tasks.json exist
async function initializeStorage() {
    try {
        await fs.mkdir('data').catch(() => {});
        try {
            await fs.access('data/tasks.json');
        } catch {
            // Initialize with default structure
            const defaultData = {
                boards: {
                    work: {
                        name: 'Work',
                        columns: {
                            todo: { name: 'To Do', tasks: [] },
                            doing: { name: 'Doing', tasks: [] },
                            done: { name: 'Done', tasks: [] }
                        }
                    },
                    personal: {
                        name: 'Personal',
                        columns: {
                            todo: { name: 'To Do', tasks: [] },
                            doing: { name: 'Doing', tasks: [] },
                            done: { name: 'Done', tasks: [] }
                        }
                    }
                },
                activeBoard: 'work'
            };
            await fs.writeFile('data/tasks.json', JSON.stringify(defaultData, null, 2));
        }
    } catch (error) {
        console.error('Error initializing storage:', error);
    }
}

// Initialize storage before starting server
initializeStorage();

// HTML Template
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DumbKan - Simple Kanban Board</title>
    <style>
        :root {
            /* Colors */
            --primary: #2196F3;
            --primary-hover: #1976D2;
            
            /* Light theme (default) */
            --background: #f5f5f5;
            --container: white;
            --text: #333;
            --border: #e0e0e0;
            --shadow: 0 2px 4px rgba(0,0,0,0.1);
            
            /* Layout */
            --border-radius: 12px;
            --transition: 0.2s ease;
        }

        /* Dark theme class */
        body.dark-theme {
            --background: #121212;
            --container: #1e1e1e;
            --text: #ffffff;
            --border: #2d2d2d;
            --shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        /* Base styles */
        body {
            font-family: -apple-system, system-ui, sans-serif;
            background: var(--background);
            color: var(--text);
            line-height: 1.6;
            transition: background-color var(--transition),
                      color var(--transition);
        }

        .column,
        .task,
        .modal-content,
        .toast,
        .pin-input input,
        .task-form textarea,
        .cancel-button {
            background: var(--container);
            color: var(--text);
            border-color: var(--border);
            transition: all var(--transition);
        }

        .task:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .app { min-height: 100vh; padding: 2rem; }
        header {
            max-width: 1200px;
            margin: 0 auto 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1rem;
            position: relative;
        }
        h1 {
            font-size: 2rem;
            color: var(--primary);
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            transition: color var(--transition);
        }
        /* Dark theme color override for logo */
        body.dark-theme h1 {
            color: white;
        }
        #theme-toggle {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: var(--border-radius);
            transition: transform var(--transition);
            margin-left: auto;
            color: var(--text);
        }
        #theme-toggle:hover {
            transform: scale(1.1);
        }
        #theme-toggle svg {
            width: 20px;
            height: 20px;
        }
        .board {
            display: grid;
            grid-template-columns: repeat(3, minmax(300px, 1fr));
            gap: 4rem;
            max-width: 1500px;
            margin: 0 auto;
            padding: 3rem;
        }
        .column {
            background: var(--container);
            padding: 1.5rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
            width: 100%;
            min-width: 0;
            display: flex;
            flex-direction: column;
            min-height: 300px;
        }
        .column h2 {
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        .tasks {
            min-height: 200px;
            flex: 1;
            margin-bottom: 1rem;
        }
        .task {
            background: var(--container);
            padding: 1rem;
            margin-bottom: 0.5rem;
            border-radius: var(--border-radius);
            border: 1px solid var(--border);
            cursor: grab;
            transition: transform var(--transition), box-shadow var(--transition);
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            width: 100%;
            box-sizing: border-box;
        }
        .task-text {
            flex: 1;
            min-width: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            margin: 0;
            line-height: 1.4;
            max-width: 100%;
        }
        .move-indicator {
            flex-shrink: 0;
            opacity: 0.5;
            font-size: 1.2rem;
            cursor: grab;
        }
        .task:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .task.dragging {
            opacity: 0.5;
            cursor: grabbing;
        }
        .add-task {
            width: 100%;
            padding: 0.75rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: background-color var(--transition);
            margin-top: auto;
        }
        .add-task:hover {
            background: var(--primary-hover);
        }
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 2rem;
            background: var(--container);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            z-index: 9999;
        }
        .modal-content {
            background: var(--container);
            padding: 2rem;
            border-radius: var(--border-radius);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            width: 90%;
            max-width: 500px;
            text-align: center;
            position: relative;
            z-index: 10000;
            box-sizing: border-box;
        }
        .modal h2 { margin-bottom: 2rem; color: var(--text); }
        .pin-input {
            margin-bottom: 2rem;
            width: 100%;
        }
        .pin-input input {
            width: 100%;
            height: 3rem;
            text-align: center;
            font-size: 1.5rem;
            border: 2px solid var(--border);
            border-radius: var(--border-radius);
            background: var(--container);
            color: var(--text);
            transition: border-color var(--transition);
            padding: 0.5rem;
        }
        .pin-input input:focus {
            outline: none;
            border-color: var(--primary);
        }
        .pin-input input.has-value {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
        }
        .pin-submit {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            font-size: 1rem;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: background-color var(--transition);
        }
        .pin-submit:hover {
            background: var(--primary-hover);
        }
        @media (max-width: 768px) {
            .app {
                padding: 1rem;
            }
            
            .board {
                grid-template-columns: 1fr;
                gap: 1.5rem;
                padding: 0.5rem;
                margin: 0 auto;
                max-width: 600px;
            }

            .column {
                padding: 1rem;
                margin: 0 auto;
                width: 95%;
            }

            header {
                flex-direction: column;
                gap: 1rem;
                align-items: center;
                padding: 1rem;
            }

            .header-left {
                flex-direction: column;
                gap: 1rem;
                width: 100%;
                align-items: center;
            }

            h1 {
                position: static;
                transform: none;
                margin-bottom: 0.5rem;
            }

            .board-selector {
                margin-left: 0;
                width: 100%;
                max-width: 300px;
            }

            .board-button {
                width: 100%;
                justify-content: center;
            }

            .board-menu {
                width: 100%;
            }

            #theme-toggle {
                position: absolute;
                top: 1rem;
                right: 1rem;
            }

            .task {
                padding: 0.75rem;
                margin-bottom: 0.75rem;
                width: 100%;
            }

            .add-task {
                padding: 0.75rem;
                width: 100%;
            }

            .board-selector {
                margin-left: 0;
            }

            .board-button {
                padding: 0.5rem 0.75rem;
                min-width: 100px;
                font-size: 0.9rem;
            }

            .board-menu {
                min-width: 180px;
            }

            .board-menu button {
                padding: 0.75rem;
                font-size: 0.9rem;
            }

            .task-text {
                font-size: 0.95rem;
            }

            .modal-content {
                padding: 1.5rem;
                width: 95%;
                max-width: 350px;
            }

            .task-form textarea {
                padding: 0.75rem;
                min-height: 100px;
                font-size: 0.95rem;
            }
        }

        @media (max-width: 480px) {
            .app {
                padding: 1rem;
            }

            .board {
                padding: 0.5rem;
            }

            h1 {
                font-size: 1.5rem;
            }

            .board-selector {
                margin-left: 0.75rem;
            }

            .board-button {
                min-width: 90px;
                font-size: 0.85rem;
            }

            .column-name {
                font-size: 1.1rem;
            }

            .task {
                font-size: 0.9rem;
            }
        }
        .pin-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--background);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 2rem;
            z-index: 1000;
        }
        .pin-header {
            position: absolute;
            top: 15%;
            left: 50%;
            transform: translateX(-50%);
        }
        .pin-header h1 {
            margin: 0;
            color: var(--text);
        }
        .pin-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            align-items: center;
            background: var(--container);
            padding: 2rem;
            border-radius: 16px;
            box-shadow: var(--shadow);
        }
        .pin-form h2 {
            margin: 0;
            color: var(--text);
        }
        .pin-input-container {
            display: flex;
            gap: 0.75rem;
            margin: 1rem 0;
        }
        .pin-input-container input.pin-input {
            width: 35px;
            height: 45px;
            text-align: center;
            font-size: 1.25rem;
            border: 2px solid var(--border);
            border-radius: 8px;
            background: var(--container);
            color: var(--text);
            transition: all var(--transition);
            flex: none;
            max-width: 30px;
            padding: 0;
        }
        .pin-input-container input.pin-input.has-value {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
        }
        .pin-input-container input.pin-input:focus {
            outline: none;
            border-color: var(--primary);
        }
        .pin-error {
            color: #f44336;
            margin: 0;
            font-size: 0.9rem;
        }
        .task-form {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            width: 100%;
            box-sizing: border-box;
        }
        .task-form textarea {
            width: 92%;
            box-sizing: border-box;
            padding: 1rem;
            font-size: 1rem;
            border: 2px solid var(--border);
            border-radius: var(--border-radius);
            background: var(--container);
            color: var(--text);
            resize: vertical;
            min-height: 120px;
            max-height: 300px;
            font-family: inherit;
            line-height: 1.5;
            margin: 0;
        }
        .task-form textarea:focus {
            outline: none;
            border-color: var(--primary);
        }
        .modal-buttons {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
        }
        .cancel-button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            background: var(--container);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all var(--transition);
        }
        .cancel-button:hover {
            background: var(--border);
        }
        .submit-button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: background-color var(--transition);
        }
        .submit-button:hover {
            background: var(--primary-hover);
        }
        .task .delete-task {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--container);
            border: 1px solid var(--border);
            color: #f44336;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            line-height: 1;
            transition: all var(--transition);
        }
        .task:hover .delete-task {
            display: flex;
        }
        .task .delete-task:hover {
            background: #f44336;
            color: white;
            border-color: #f44336;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .board-selector {
            position: relative;
            z-index: 1;
        }

        .board-button {
            background: var(--container);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.5rem 1rem;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all var(--transition);
        }

        .board-button:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }

        .board-button::after {
            content: "▼";
            font-size: 0.8em;
        }

        .board-menu {
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 0.5rem;
            background: var(--container);
            border: 1px solid var(--border);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            min-width: 150px;
            z-index: 100;
        }

        .board-menu button {
            width: 100%;
            padding: 0.75rem 1rem;
            text-align: left;
            background: none;
            border: none;
            color: var(--text);
            cursor: pointer;
            transition: all var(--transition);
        }

        .board-menu button:hover {
            background: var(--primary);
            color: white;
        }

        .board-menu button:not(:last-child) {
            border-bottom: 1px solid var(--border);
        }

        .boards-list {
            margin: 1rem 0;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .board-item {
            display: flex;
            align-items: center;
            padding: 0.75rem 1rem;
            background: var(--container);
            border: 1px solid var(--border);
            border-radius: var(--border-radius);
            transition: all var(--transition);
        }

        .board-item:hover {
            border-color: var(--primary);
            transform: translateX(4px);
        }

        .board-item .board-name {
            flex: 1;
            margin-right: 1rem;
        }

        .board-item .delete-board {
            opacity: 0;
            background: none;
            border: none;
            color: #f44336;
            cursor: pointer;
            padding: 0.5rem;
            margin: -0.5rem;
            font-size: 1.2rem;
            transition: all var(--transition);
        }

        .board-item:hover .delete-board {
            opacity: 1;
        }

        .board-item .delete-board:hover {
            transform: scale(1.1);
        }

        .add-board-form {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid var(--border);
        }

        .add-board-form input {
            flex: 1 1 150px;
            padding: 0.75rem 1rem;
            font-size: 1rem;
            border: 2px solid var(--border);
            border-radius: var(--border-radius);
            background: var(--container);
            color: var(--text);
            transition: all var(--transition);
        }

        .add-board-form input:focus {
            outline: none;
            border-color: var(--primary);
        }

        .add-button {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 1rem;
            transition: all var(--transition);
        }

        .add-button:hover {
            background: var(--primary-hover);
        }

        .add-button .icon {
            font-size: 1.2em;
            line-height: 1;
        }

        .manage-boards-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.75rem 1rem;
            margin-top: 0.5rem;
            border-top: 1px solid var(--border);
            background: none;
            border: none;
            color: var(--text);
            cursor: pointer;
            transition: all var(--transition);
        }

        .manage-boards-btn:hover {
            color: var(--primary);
        }

        .manage-boards-btn .icon {
            font-size: 1.1em;
            opacity: 0.8;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .close-button {
            background: none;
            border: none;
            color: var(--text);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            margin: -0.5rem;
            transition: transform var(--transition);
        }

        .close-button:hover {
            transform: scale(1.1);
        }

        .delete-confirmation {
            max-width: 500px !important;
        }
        
        .delete-warning {
            text-align: left;
            margin-bottom: 1.5rem;
            color: var(--text);
        }
        
        .delete-warning p {
            margin-bottom: 1rem;
            line-height: 1.5;
        }
        
        .delete-confirmation-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .delete-confirmation-input {
            width: 100%;
            padding: 0.75rem 1rem;
            font-size: 1rem;
            border: 2px solid var(--border);
            border-radius: var(--border-radius);
            background: var(--container);
            color: var(--text);
            box-sizing: border-box;
        }
        
        .delete-confirmation-input:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .delete-button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: background-color var(--transition);
        }
        
        .delete-button:hover {
            background: #c82333;
        }
        
        .delete-button:disabled {
            background: #e9ecef;
            cursor: not-allowed;
        }

        .task {
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        }
        
        .task.dragging {
            opacity: 0.5;
            position: relative;
            z-index: 1000;
            cursor: grabbing;
            transform: scale(1.02);
            transition: transform 0.2s ease;
        }
        
        @media (hover: none) and (pointer: coarse) {
            .task:active {
                cursor: grabbing;
            }
        }

        .task {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem;
            padding-right: 2.5rem;
            touch-action: manipulation;
            user-select: none;
            -webkit-user-select: none;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .move-indicator {
            color: var(--border);
            font-size: 1.2em;
            line-height: 1;
            cursor: move;
            padding: 0.25rem;
            margin: -0.25rem;
            display: none;
            opacity: 0.6;
        }
        
        @media (hover: none) and (pointer: coarse) {
            .move-indicator {
                display: block;
            }
            
            .task {
                padding-left: 2.5rem;
            }
        }
        
        .task-content {
            flex: 1;
            min-width: 0;
        }
        
        .task-text {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .task.dragging {
            opacity: 0.8;
            transform: scale(1.02);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        
        .tasks.drag-over {
            background: var(--primary);
            opacity: 0.1;
            transition: all 0.2s ease;
        }
        
        .delete-task {
            position: absolute;
            top: 50%;
            right: 0.5rem;
            transform: translateY(-50%);
        }

        /* Add Column Button */
        .add-column {
            min-width: 300px;
            height: 200px;
            background: var(--container);
            border: 2px dashed var(--border);
            border-radius: var(--border-radius);
            color: var(--text);
            cursor: pointer;
            font-size: 1.1rem;
            transition: all var(--transition);
            opacity: 0.7;
            margin-top: 43px;
            height: fit-content;
            align-self: start;
        }

        .add-column:hover {
            opacity: 1;
            border-color: var(--primary);
            color: var(--primary);
        }

        /* Mobile Touch Styles */
        .task {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem;
            padding-right: 2.5rem;
            touch-action: manipulation;
            user-select: none;
            -webkit-user-select: none;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        @media (hover: none) and (pointer: coarse) {
            .task {
                cursor: pointer;
            }
            
            .task::after {
                content: '✎';
                position: absolute;
                right: 2.5rem;
                opacity: 0.4;
                font-size: 0.9em;
            }
        }

        /* Update column header styles */
        .column-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }

        .column-name {
            margin: 0;
            font-size: 1.25rem;
            padding: 0.25rem;
            flex: 1;
            min-width: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .remove-column {
            background: none;
            border: none;
            color: #f44336;
            cursor: pointer;
            padding: 0.5rem;
            font-size: 1.2rem;
            line-height: 1;
            transition: transform var(--transition);
        }

        .remove-column:hover {
            transform: scale(1.1);
        }

        /* Tablet/medium screens */
        @media (min-width: 769px) and (max-width: 1200px) {
            .board {
                grid-template-columns: repeat(2, minmax(300px, 1fr));
                gap: 2.5rem;
                padding: 2rem;
            }
        }
    </style>
</head>
<body>
    <div id="pin-overlay" class="pin-overlay" style="display: none;">
        <div class="pin-header">
            <h1>DumbKan</h1>
        </div>
        <form id="pin-form" class="pin-form">
            <h2>Enter PIN</h2>
            <div class="pin-input-container">
                <input type="password" class="pin-input" maxlength="1" pattern="[0-9]" inputmode="numeric">
                <input type="password" class="pin-input" maxlength="1" pattern="[0-9]" inputmode="numeric">
                <input type="password" class="pin-input" maxlength="1" pattern="[0-9]" inputmode="numeric">
                <input type="password" class="pin-input" maxlength="1" pattern="[0-9]" inputmode="numeric">
            </div>
            <p id="pin-error" class="pin-error" style="display: none;">Invalid PIN. Please try again.</p>
        </form>
    </div>

    <div id="task-modal" class="modal" style="display: none">
        <div class="modal-content">
            <h2 id="task-modal-title">Add Task</h2>
            <form id="task-form" class="task-form">
                <textarea 
                    id="task-input" 
                    placeholder="What needs to be done?" 
                    rows="3" 
                    maxlength="500"
                    required
                ></textarea>
                <div class="modal-buttons">
                    <button type="button" class="cancel-button" onclick="closeTaskModal()">Cancel</button>
                    <button type="button" id="delete-task-btn" class="delete-button" style="display: none;">Delete Task</button>
                    <button type="submit" class="submit-button">Save</button>
                </div>
            </form>
        </div>
    </div>

    <div id="manage-boards-modal" class="modal" style="display: none">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Manage Boards</h2>
                <button class="close-button" onclick="closeManageBoardsModal()">×</button>
            </div>
            <div id="boards-list" class="boards-list"></div>
            <form id="add-board-form" class="add-board-form">
                <input type="text" id="new-board-name" 
                    placeholder="Enter board name" 
                    pattern="[A-Za-z0-9 -]+" 
                    title="Letters, numbers, spaces and hyphens only"
                    required>
                <button type="submit" class="add-button">
                    <span class="icon">+</span>
                    Add Board
                </button>
            </form>
        </div>
    </div>

    <div id="delete-board-modal" class="modal" style="display: none">
        <div class="modal-content delete-confirmation">
            <div class="modal-header">
                <h2>Delete Board</h2>
                <button class="close-button" onclick="closeDeleteBoardModal()">×</button>
            </div>
            <div class="delete-warning">
                <p>This action cannot be undone. This will permanently delete the <strong id="delete-board-name"></strong> board and all of its tasks.</p>
                <p>Please type <strong id="delete-board-confirm-text"></strong> to confirm.</p>
            </div>
            <form id="delete-board-form" class="delete-confirmation-form">
                <input type="text" id="delete-board-input" 
                    placeholder="Type board name to confirm"
                    class="delete-confirmation-input"
                    required>
                <div class="modal-buttons">
                    <button type="button" class="cancel-button" onclick="closeDeleteBoardModal()">Cancel</button>
                    <button type="submit" class="delete-button">Delete this board</button>
                </div>
            </form>
        </div>
    </div>

    <div id="delete-column-modal" class="modal" style="display: none">
        <div class="modal-content delete-confirmation">
            <div class="modal-header">
                <h2>Delete Column</h2>
                <button class="close-button" onclick="closeDeleteColumnModal()">×</button>
            </div>
            <div class="delete-warning">
                <p>Are you sure you want to remove this column and all its tasks?</p>
                <p>This action cannot be undone.</p>
            </div>
            <div class="modal-buttons">
                <button class="cancel-button" onclick="closeDeleteColumnModal()">Cancel</button>
                <button class="delete-button" onclick="confirmDeleteColumn()">Delete Column</button>
            </div>
        </div>
    </div>

    <div class="app">
        <header>
            <div class="header-left">
                <h1>DumbKan</h1>
                <div class="board-selector">
                    <button id="current-board" class="board-button">Work</button>
                    <div id="board-menu" class="board-menu" hidden>
                        <div id="boards-list-menu"></div>
                        <button class="manage-boards-btn" onclick="openManageBoardsModal()">
                            <span class="icon">⚙️</span> Manage Boards
                        </button>
                    </div>
                </div>
            </div>
            <button id="theme-toggle" aria-label="Toggle dark mode">🌙</button>
        </header>
        <main>
            <div class="board">
                <div class="column" data-column="todo">
                    <h2 contenteditable="true" class="column-name">To Do</h2>
                    <div class="tasks" id="todo"></div>
                    <button class="add-task" data-column="todo">+ Add Task</button>
                </div>
                <div class="column" data-column="doing">
                    <h2 contenteditable="true" class="column-name">Doing</h2>
                    <div class="tasks" id="doing"></div>
                    <button class="add-task" data-column="doing">+ Add Task</button>
                </div>
                <div class="column" data-column="done">
                    <h2 contenteditable="true" class="column-name">Done</h2>
                    <div class="tasks" id="done"></div>
                    <button class="add-task" data-column="done">+ Add Task</button>
                </div>
                <button id="add-column" class="add-column">+ Add Column</button>
            </div>
        </main>
        <div id="toast" class="toast" hidden></div>
    </div>

    <script>
        // DOM Elements
        const board = document.querySelector('.board');
        const columns = document.querySelectorAll('.column');
        const columnNames = document.querySelectorAll('.column-name');
        const addButtons = document.querySelectorAll('.add-task');
        const themeToggle = document.getElementById('theme-toggle');
        const toast = document.getElementById('toast');
        const pinOverlay = document.getElementById('pin-overlay');
        const pinForm = document.getElementById('pin-form');
        const pinInput = document.getElementById('pin-input');

        // State
        let boardData = {
            boards: {
                work: {
                    name: 'Work',
                    columns: {
                        todo: { name: 'To Do', tasks: [] },
                        doing: { name: 'Doing', tasks: [] },
                        done: { name: 'Done', tasks: [] }
                    }
                }
            },
            activeBoard: 'work'
        };
        let currentBoard = 'work';
        let verifiedPin = null;

        // Board selector
        const currentBoardBtn = document.getElementById('current-board');
        const boardMenu = document.getElementById('board-menu');
        const boardsListMenu = document.getElementById('boards-list-menu');

        // Show/hide boards list on current board button click
        currentBoardBtn.addEventListener('click', () => {
            boardMenu.hidden = !boardMenu.hidden;
        });

        // Handle board selection
        boardsListMenu.addEventListener('click', async (e) => {
            const button = e.target;
            if (!button.dataset.board) return;

            const boardId = button.dataset.board;
            if (boardId === currentBoard) return;

            try {
                // Update current board
                currentBoard = boardId;
                
                // Update UI
                currentBoardBtn.textContent = boardData.boards[boardId].name;
                boardMenu.hidden = true;
                
                // Save active board
                const headers = {
                    'Content-Type': 'application/json',
                    ...(verifiedPin && { 'X-Pin': verifiedPin })
                };
                
                const response = await fetch('/data/tasks.json', { headers });
                const data = await response.json();
                data.activeBoard = boardId;
                
                await fetch('/data/tasks.json', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data, null, 2)
                });
                
                // Load tasks for the new board
                await loadTasks();
                showToast('Switched to ' + button.textContent + ' board');
            } catch (error) {
                console.error('Error switching board:', error);
                showToast('Error switching board');
            }
        });

        // Close board menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!currentBoardBtn.contains(e.target) && !boardMenu.contains(e.target)) {
                boardMenu.hidden = true;
            }
        });

        // Function to update board selector
        async function updateBoardSelector() {
            const headers = {
                'Content-Type': 'application/json',
                ...(verifiedPin && { 'X-Pin': verifiedPin })
            };

            try {
                const response = await fetch('/data/tasks.json', { headers });
                const data = await response.json();
                
                // Update current board button
                const currentBoardData = data.boards[currentBoard];
                if (currentBoardData) {
                    currentBoardBtn.textContent = currentBoardData.name;
                }
                
                // Populate dropdown menu
                boardsListMenu.innerHTML = '';
                Object.entries(data.boards).forEach(([id, board]) => {
                    const button = document.createElement('button');
                    button.dataset.board = id;
                    button.textContent = board.name;
                    if (id === currentBoard) {
                        button.classList.add('active');
                    }
                    boardsListMenu.appendChild(button);
                });

                // Update boardData
                boardData = data;
            } catch (error) {
                console.error('Error updating board selector:', error);
            }
        }

        // Initial board selector update
        document.addEventListener('DOMContentLoaded', () => {
            updateBoardSelector();
        });

        // Load tasks from JSON file
        async function loadTasks() {
            try {
                const headers = verifiedPin ? { 'X-Pin': verifiedPin } : {};
                const response = await fetch('/data/tasks.json', { headers });
                
                if (response.status === 401) {
                    localStorage.removeItem('DUMBKAN_PIN');
                    location.reload();
                    return;
                }
                
                if (!response.ok) throw new Error('Failed to load tasks');
                const data = await response.json();
                
                // Only initialize default structure if data is empty
                if (!data || !Object.keys(data).length) {
                    data.boards = {
                        work: {
                            name: 'Work',
                            columns: {
                                todo: { name: 'To Do', tasks: [] },
                                doing: { name: 'Doing', tasks: [] },
                                done: { name: 'Done', tasks: [] }
                            }
                        }
                    };
                    data.activeBoard = 'work';
                }
                
                // Update the global boardData
                boardData = data;
                currentBoard = data.activeBoard || Object.keys(data.boards)[0];
                
                // Update UI
                currentBoardBtn.textContent = data.boards[currentBoard].name;
                renderTasks();
                updateBoardSelector();
            } catch (error) {
                console.error('Error loading tasks:', error);
                showToast('Error loading tasks');
            }
        }

        // Column name editing
        columnNames.forEach(nameEl => {
            nameEl.addEventListener('blur', () => {
                const column = nameEl.closest('.column').dataset.column;
                boardData.boards[currentBoard].columns[column].name = nameEl.textContent;
                saveTasks();
            });

            nameEl.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    nameEl.blur();
                }
            });
        });

        // Wrap fetch to include PIN header
        const fetchWithPin = async (url, options = {}) => {
            if (verifiedPin) {
                options.headers = {
                    ...options.headers,
                    'X-Pin': verifiedPin
                };
            }
            return fetch(url, options);
        };

        // Check if PIN is required and get length
        async function checkPinRequired() {
            const response = await fetch('/api/pin-required');
            const { required, length } = await response.json();
            if (required && !verifiedPin) {
                const container = document.querySelector('.pin-input-container');
                container.innerHTML = ''; // Clear existing inputs
                
                // Create inputs based on PIN length
                for (let i = 0; i < length; i++) {
                    const input = document.createElement('input');
                    input.type = 'password';
                    input.className = 'pin-input';
                    input.maxLength = 1;
                    input.pattern = '[0-9]';
                    input.inputMode = 'numeric';
                    input.required = true;
                    container.appendChild(input);
                }
                
                setupPinInputs();
                document.querySelector('.pin-input').focus();
            }
        }

        // Separate function to set up PIN input event listeners
        function setupPinInputs() {
            document.querySelectorAll('.pin-input').forEach((input, index, inputs) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value) {
                        e.target.classList.add('has-value');
                        if (index < inputs.length - 1) {
                            inputs[index + 1].focus();
                        } else {
                            document.getElementById('pin-form').requestSubmit();
                        }
                    } else {
                        e.target.classList.remove('has-value');
                    }
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        const prevInput = inputs[index - 1];
                        prevInput.value = '';
                        prevInput.classList.remove('has-value');
                        prevInput.focus();
                    }
                });
            });
        }

        // Handle PIN form submission
        document.getElementById('pin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = [...document.querySelectorAll('.pin-input')];
            const pin = inputs.map(input => input.value).join('');
            
            try {
                const response = await fetch('/api/verify-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    window.location.href = '/';
                } else {
                    const errorElement = document.getElementById('pin-error');
                    if (response.status === 429) {
                        errorElement.textContent = data.error;
                    } else {
                        const msg = 'Invalid PIN. ' + data.attemptsLeft + ' attempts remaining';
                        errorElement.textContent = msg;
                    }
                    errorElement.style.display = 'block';
                    
                    // Reset all PIN input boxes
                    const pinInputs = document.querySelectorAll('.pin-input');
                    pinInputs.forEach(input => {
                        input.value = '';
                        input.classList.remove('has-value');
                    });
                    // Focus the first input box
                    pinInputs[0].focus();
                }
            } catch (error) {
                console.error('Error verifying PIN:', error);
                document.getElementById('pin-error').style.display = 'block';
            }
        });

        // Initialize PIN check
        checkPinRequired();

        // Task Modal
        const taskModal = document.getElementById('task-modal');
        const taskForm = document.getElementById('task-form');
        const taskInput = document.getElementById('task-input');
        const taskModalTitle = document.getElementById('task-modal-title');
        let currentTaskAction = { type: 'add', column: null, task: null };

        // Handle Enter key in task input
        taskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                taskForm.requestSubmit();
            }
        });

        function openTaskModal(type, column, task = null) {
            currentTaskAction = { type, column, task };
            taskModalTitle.textContent = type === 'add' ? 'Add Task' : 'Edit Task';
            taskInput.value = task ? task.querySelector('.task-text').textContent : '';
            
            const deleteBtn = document.getElementById('delete-task-btn');
            if (type === 'edit') {
                deleteBtn.style.display = 'block';
                deleteBtn.onclick = () => {
                    if (confirm('Are you sure you want to delete this task?')) {
                        const columnId = task.parentElement.id;
                        const index = Array.from(task.parentElement.children).indexOf(task);
                        boardData.boards[currentBoard].columns[columnId].tasks.splice(index, 1);
                        task.remove();
                        saveTasks();
                        showToast('Task deleted');
                        closeTaskModal();
                    }
                };
            } else {
                deleteBtn.style.display = 'none';
            }
            
            taskModal.style.display = 'flex';
            taskInput.focus();
        }

        function closeTaskModal() {
            taskModal.style.display = 'none';
            taskInput.value = '';
        }

        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = taskInput.value.trim();
            if (!text) return;

            if (currentTaskAction.type === 'add') {
                // Add task to data structure
                boardData.boards[currentBoard].columns[currentTaskAction.column].tasks.push(text);
                
                // Create and append the task element
                const task = createTask(currentTaskAction.column, text);
                if (task) {
                    document.getElementById(currentTaskAction.column).appendChild(task);
                }
            } else {
                // Update existing task
                const task = currentTaskAction.task;
                const columnId = task.closest('.column').dataset.column;
                const tasksContainer = task.parentElement;
                const index = Array.from(tasksContainer.children).indexOf(task);
                
                // Update data structure
                boardData.boards[currentBoard].columns[columnId].tasks[index] = text;
                
                // Update UI
                task.querySelector('.task-text').textContent = text;
            }

            // Save changes
            await saveTasks();
            closeTaskModal();
        });

        // Task Management
        function createTask(column, text = '') {
            if (!boardData.boards[currentBoard].columns[column]) {
                console.error('Invalid column:', column);
                return null;
            }

            const task = document.createElement('div');
            task.className = 'task';
            task.draggable = true;
            
            // Create move indicator for mobile (first)
            const moveIndicator = document.createElement('div');
            moveIndicator.className = 'move-indicator';
            moveIndicator.innerHTML = '⋮⋮';
            moveIndicator.title = 'Hold and drag to move';
            task.appendChild(moveIndicator);
            
            // Create task content wrapper
            const taskContent = document.createElement('div');
            taskContent.className = 'task-content';
            
            // Create task text
            const taskText = document.createElement('span');
            taskText.className = 'task-text';
            taskText.textContent = text;
            taskContent.appendChild(taskText);
            task.appendChild(taskContent);

            // Double tap/click detection
            let lastTap = 0;
            let tapTimeout;

            task.addEventListener('touchstart', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                
                clearTimeout(tapTimeout);
                
                if (tapLength < 500 && tapLength > 0) {
                    // Double tap detected
                    e.preventDefault();
                    openTaskModal('edit', column, task);
                } else {
                    // Wait for potential second tap
                    tapTimeout = setTimeout(() => {
                        // Single tap - handle drag start
                        touchStartY = e.touches[0].clientY;
                        touchStartX = e.touches[0].clientX;
                        originalColumn = task.parentElement;
                        lastTouch = e.touches[0];
                        
                        feedbackTimeout = setTimeout(() => {
                            task.classList.add('dragging');
                            showToast('Move task to another column');
                            isDragging = true;
                        }, 200);
                    }, 200);
                }
                lastTap = currentTime;
            });

            // Desktop double click
            task.addEventListener('dblclick', () => openTaskModal('edit', column, task));

            // Touch event handling
            let touchStartY = 0;
            let touchStartX = 0;
            let originalColumn = null;
            let isDragging = false;
            let feedbackTimeout;
            let lastTouch = null;

            task.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent default to work better on Android
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
                originalColumn = task.parentElement;
                lastTouch = e.touches[0];
                
                feedbackTimeout = setTimeout(() => {
                    task.classList.add('dragging');
                    showToast('Move task to another column');
                    isDragging = true;
                }, 200);
            });

            task.addEventListener('touchmove', (e) => {
                e.preventDefault();
                lastTouch = e.touches[0];

                if (!isDragging) {
                    if (Math.abs(e.touches[0].clientY - touchStartY) > 5 || 
                        Math.abs(e.touches[0].clientX - touchStartX) > 5) {
                        clearTimeout(feedbackTimeout);
                    }
                    return;
                }

                const touch = e.touches[0];
                
                const elementsUnderTouch = document.elementsFromPoint(touch.clientX, touch.clientY);
                const columnUnderTouch = elementsUnderTouch.find(el => el.classList.contains('tasks'));
                
                if (columnUnderTouch) {
                    columnUnderTouch.classList.add('drag-over');
                    const tasks = [...columnUnderTouch.querySelectorAll('.task:not(.dragging)')];
                    const closestTask = tasks.reduce((closest, child) => {
                        const box = child.getBoundingClientRect();
                        const offset = touch.clientY - box.top - box.height / 2;
                        if (offset < 0 && offset > closest.offset) {
                            return { offset, element: child };
                        } else {
                            return closest;
                        }
                    }, { offset: Number.NEGATIVE_INFINITY }).element;

                    if (closestTask) {
                        columnUnderTouch.insertBefore(task, closestTask);
                    } else {
                        columnUnderTouch.appendChild(task);
                    }
                    
                    document.querySelectorAll('.tasks').forEach(col => {
                        if (col !== columnUnderTouch) col.classList.remove('drag-over');
                    });
                }
            });

            task.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(feedbackTimeout);
                if (isDragging) {
                    task.classList.remove('dragging');
                    document.querySelectorAll('.tasks').forEach(col => col.classList.remove('drag-over'));
                    updateTasksArray();
                    showToast('Task moved');
                }
                isDragging = false;
                lastTouch = null;
            });

            task.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                clearTimeout(feedbackTimeout);
                task.classList.remove('dragging');
                document.querySelectorAll('.tasks').forEach(col => col.classList.remove('drag-over'));
                isDragging = false;
                lastTouch = null;
                if (originalColumn) {
                    originalColumn.appendChild(task);
                }
            });

            // Desktop drag events
            task.addEventListener('dragstart', () => {
                task.classList.add('dragging');
                showToast('Drop in another column to move');
            });
            
            task.addEventListener('dragend', () => {
                task.classList.remove('dragging');
                document.querySelectorAll('.tasks').forEach(col => col.classList.remove('drag-over'));
                updateTasksArray();
                showToast('Task moved');
            });

            return task;
        }

        // Close move buttons when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.task')) {
                const allMoveButtons = document.querySelectorAll('.move-buttons');
                allMoveButtons.forEach(btns => btns.style.display = 'none');
            }
        });

        // Add task buttons
        addButtons.forEach(button => {
            button.addEventListener('click', () => {
                const column = button.dataset.column;
                openTaskModal('add', column);
            });
        });

        // Close modal when clicking outside
        taskModal.addEventListener('click', (e) => {
            if (e.target === taskModal) {
                closeTaskModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !taskModal.hidden) {
                closeTaskModal();
            }
        });

        // Drag and Drop
        columns.forEach(column => {
            const tasksContainer = column.querySelector('.tasks');
            
            tasksContainer.addEventListener('dragover', e => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (!dragging) return;

                const notDragging = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
                const nextTask = notDragging.find(task => {
                    const rect = task.getBoundingClientRect();
                    return e.clientY < rect.top + rect.height / 2;
                });
                
                if (nextTask) {
                    tasksContainer.insertBefore(dragging, nextTask);
                } else {
                    tasksContainer.appendChild(dragging);
                }
            });
        });

        // Utilities
        function updateTasksArray() {
            // Get all columns
            document.querySelectorAll('.column').forEach(column => {
                const columnId = column.dataset.column;
                const tasksContainer = column.querySelector('.tasks');
                if (!tasksContainer) return;

                const tasks = tasksContainer.querySelectorAll('.task');
                
                // Update the tasks array for the current board and column
                if (boardData.boards[currentBoard].columns[columnId]) {
                    boardData.boards[currentBoard].columns[columnId].tasks = Array.from(tasks)
                        .map(task => {
                            const taskText = task.querySelector('.task-text');
                            return taskText ? taskText.textContent.trim() : '';
                        })
                        .filter(text => text); // Remove any empty tasks
                }
            });

            // Save changes to the server
            saveTasks();
        }

        async function saveTasks() {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    ...(verifiedPin && { 'X-Pin': verifiedPin })
                };

                // Save the entire boardData object
                const saveResponse = await fetch('/data/tasks.json', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(boardData, null, 2)
                });
                
                if (saveResponse.status === 401) {
                    localStorage.removeItem('DUMBKAN_PIN');
                    location.reload();
                    return;
                }
                
                if (!saveResponse.ok) throw new Error('Failed to save tasks');
                
                showToast('Changes saved');
            } catch (error) {
                console.error('Error saving tasks:', error);
                showToast('Error saving changes');
            }
        }

        function showToast(message) {
            toast.textContent = message;
            toast.hidden = false;
            setTimeout(() => toast.hidden = true, 2000);
        }

        function renderTasks() {
            const board = document.querySelector('.board');
            while (board.firstChild && board.firstChild !== addColumnBtn) {
                board.removeChild(board.firstChild);
            }

            Object.entries(boardData.boards[currentBoard].columns).forEach(([columnId, column]) => {
                const columnEl = document.createElement('div');
                columnEl.className = 'column';
                columnEl.dataset.column = columnId;

                // Create column header container
                const headerDiv = document.createElement('div');
                headerDiv.className = 'column-header';

                // Create column name
                const h2 = document.createElement('h2');
                h2.className = 'column-name';
                h2.contentEditable = true;
                h2.textContent = column.name;

                // Create remove column button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-column';
                removeBtn.innerHTML = '×';
                removeBtn.title = 'Remove column';
                removeBtn.onclick = () => openDeleteColumnModal(columnId);

                // Append header elements
                headerDiv.appendChild(h2);
                headerDiv.appendChild(removeBtn);
                columnEl.appendChild(headerDiv);

                // Create tasks container
                const tasksDiv = document.createElement('div');
                tasksDiv.className = 'tasks';
                tasksDiv.id = columnId;

                // Create add task button
                const addButton = document.createElement('button');
                addButton.className = 'add-task';
                addButton.dataset.column = columnId;
                addButton.textContent = '+ Add Task';

                // Add event listeners
                h2.addEventListener('blur', () => {
                    boardData.boards[currentBoard].columns[columnId].name = h2.textContent;
                    saveTasks();
                });

                h2.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        h2.blur();
                    }
                });

                addButton.addEventListener('click', () => {
                    openTaskModal('add', columnId);
                });

                // Append remaining elements
                columnEl.appendChild(tasksDiv);
                columnEl.appendChild(addButton);

                // Render tasks for this column
                if (column.tasks && Array.isArray(column.tasks)) {
                    const uniqueTasks = [...new Set(column.tasks)].filter(task => task && task.trim());
                    uniqueTasks.forEach(taskText => {
                        const task = createTask(columnId, taskText);
                        if (task) {
                            tasksDiv.appendChild(task);
                        }
                    });
                }

                // Insert before add column button
                board.insertBefore(columnEl, addColumnBtn);
            });

            // Add drag and drop event listeners
            addColumnEventListeners();
        }

        // Initialize app
        async function initializeApp() {
            const storedPin = localStorage.getItem('DUMBKAN_PIN');
            if (storedPin) {
                // Override fetch to include PIN header
                const originalFetch = window.fetch;
                window.fetch = function(url, options = {}) {
                    options.headers = {
                        ...options.headers,
                        'X-Pin': storedPin
                    };
                    return originalFetch(url, options);
                };
            }

            try {
                await loadTasks();
            } catch (error) {
                console.error('Failed to load tasks:', error);
                // Clear PIN and redirect to login if unauthorized
                if (error.status === 401) {
                    localStorage.removeItem('DUMBKAN_PIN');
                    window.location.replace('/login');
                }
            }
        }

        // Wait for DOM content to be loaded before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            initializeApp();
        }

        // Theme handling
        function setTheme(isDark, showToastMessage = false) {
            if (isDark) {
                document.body.classList.add('dark-theme');
                themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
                if (showToastMessage) showToast('Dark mode enabled');
            } else {
                document.body.classList.remove('dark-theme');
                themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
                if (showToastMessage) showToast('Light mode enabled');
            }
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }

        // Initialize theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme) {
            setTheme(savedTheme === 'dark', false); // Don't show toast on initial load
        } else {
            setTheme(prefersDark.matches, false); // Don't show toast on initial load
        }

        // Theme toggle button
        themeToggle.addEventListener('click', () => {
            const isDark = !document.body.classList.contains('dark-theme');
            setTheme(isDark, true); // Show toast when user clicks
        });

        // Listen for system theme changes
        prefersDark.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                setTheme(e.matches, true); // Show toast when system theme changes
            }
        });

        // Board Management
        const manageBoardsModal = document.getElementById('manage-boards-modal');
        const boardsList = document.getElementById('boards-list');
        const addBoardForm = document.getElementById('add-board-form');
        const newBoardInput = document.getElementById('new-board-name');

        function openManageBoardsModal() {
            boardMenu.hidden = true;
            manageBoardsModal.style.display = 'flex';
            renderBoardsList();
        }

        function closeManageBoardsModal() {
            manageBoardsModal.style.display = 'none';
            newBoardInput.value = '';
        }

        function renderBoardsList() {
            boardsList.innerHTML = '';
            Object.entries(boardData.boards).forEach(([id, board]) => {
                const item = document.createElement('div');
                item.className = 'board-item';
                
                const name = document.createElement('span');
                name.className = 'board-name';
                name.textContent = board.name;
                item.appendChild(name);
                
                if (Object.keys(boardData.boards).length > 1) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-board';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.title = 'Delete board';
                    deleteBtn.onclick = () => openDeleteBoardModal(id);
                    item.appendChild(deleteBtn);
                }
                
                boardsList.appendChild(item);
            });
        }

        let boardToDelete = null;
        const deleteConfirmForm = document.getElementById('delete-board-form');
        const deleteConfirmInput = document.getElementById('delete-board-input');

        function openDeleteBoardModal(boardId) {
            boardToDelete = boardId;
            const boardName = boardData.boards[boardId].name;
            document.getElementById('delete-board-name').textContent = boardName;
            document.getElementById('delete-board-confirm-text').textContent = boardName;
            deleteConfirmInput.value = '';
            document.getElementById('delete-board-modal').style.display = 'flex';
        }

        function closeDeleteBoardModal() {
            document.getElementById('delete-board-modal').style.display = 'none';
            boardToDelete = null;
        }

        deleteConfirmForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const confirmText = deleteConfirmInput.value.trim();
            const boardName = boardData.boards[boardToDelete].name;
            
            if (confirmText !== boardName) {
                showToast('Board name does not match');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                ...(verifiedPin && { 'X-Pin': verifiedPin })
            };

            try {
                // Get current data
                const response = await fetch('/data/tasks.json', { headers });
                const data = await response.json();
                
                // Delete board
                delete data.boards[boardToDelete];
                
                // Switch to another board if deleting current
                if (boardToDelete === currentBoard) {
                    const newBoardId = Object.keys(data.boards)[0];
                    currentBoard = newBoardId;
                    currentBoardBtn.textContent = data.boards[newBoardId].name;
                }
                
                // Save changes
                const saveResponse = await fetch('/data/tasks.json', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data, null, 2)
                });
                
                if (!saveResponse.ok) throw new Error('Failed to delete board');
                
                boardData = data;
                renderBoardsList();
                updateBoardSelector();
                showToast('Board deleted');
                
                if (boardToDelete === currentBoard) {
                    loadTasks();
                }
                
                closeDeleteBoardModal();
                closeManageBoardsModal();
            } catch (error) {
                console.error('Error deleting board:', error);
                showToast('Error deleting board');
            }
        });

        addBoardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const boardName = newBoardInput.value.trim();
            if (!boardName) return;

            const boardId = boardName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            
            const headers = {
                'Content-Type': 'application/json',
                ...(verifiedPin && { 'X-Pin': verifiedPin })
            };

            try {
                // Get current data
                const response = await fetch('/data/tasks.json', { headers });
                const data = await response.json();
                
                // Add new board
                data.boards[boardId] = {
                    name: boardName,
                    columns: {
                        todo: { name: 'To Do', tasks: [] },
                        doing: { name: 'Doing', tasks: [] },
                        done: { name: 'Done', tasks: [] }
                    }
                };
                
                // Save changes
                const saveResponse = await fetch('/data/tasks.json', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data, null, 2)
                });
                
                if (!saveResponse.ok) throw new Error('Failed to add board');
                
                // Update local data and UI
                boardData = data;
                renderBoardsList();
                updateBoardSelector(); // Update the board selector dropdown
                newBoardInput.value = '';
                showToast('Board added');
                
                // Switch to the new board
                currentBoard = boardId;
                currentBoardBtn.textContent = boardName;
                await loadTasks();
                closeManageBoardsModal();
            } catch (error) {
                console.error('Error adding board:', error);
                showToast('Error adding board');
            }
        });

        // Close modal when clicking outside
        manageBoardsModal.addEventListener('click', (e) => {
            if (e.target === manageBoardsModal) {
                closeManageBoardsModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && manageBoardsModal.style.display === 'flex') {
                closeManageBoardsModal();
            }
        });

        // Add Column functionality
        const addColumnBtn = document.getElementById('add-column');

        addColumnBtn.addEventListener('click', async () => {
            const columnId = 'column-' + Date.now();
            const columnName = 'New Column';

            boardData.boards[currentBoard].columns[columnId] = {
                name: columnName,
                tasks: []
            };

            const column = document.createElement('div');
            column.className = 'column';
            column.dataset.column = columnId;

            // Create elements individually
            const h2 = document.createElement('h2');
            h2.className = 'column-name';
            h2.contentEditable = true;
            h2.textContent = columnName;

            const tasksDiv = document.createElement('div');
            tasksDiv.className = 'tasks';
            tasksDiv.id = columnId;

            const addButton = document.createElement('button');
            addButton.className = 'add-task';
            addButton.dataset.column = columnId;
            addButton.textContent = '+ Add Task';

            // Append elements
            column.appendChild(h2);
            column.appendChild(tasksDiv);
            column.appendChild(addButton);

            // Add event listeners
            h2.addEventListener('blur', () => {
                boardData.boards[currentBoard].columns[columnId].name = h2.textContent;
                saveTasks();
            });

            h2.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    h2.blur();
                }
            });

            addButton.addEventListener('click', () => {
                openTaskModal('add', columnId);
            });

            // Insert before the add column button
            addColumnBtn.parentNode.insertBefore(column, addColumnBtn);

            // Save changes
            await saveTasks();
            showToast('Column added');

            // Add drag and drop event listeners to the new column
            addColumnEventListeners();
        });

        // Add drag and drop event listeners to columns
        function addColumnEventListeners() {
            document.querySelectorAll('.tasks').forEach(tasksContainer => {
                tasksContainer.addEventListener('dragover', e => {
                    e.preventDefault();
                    const dragging = document.querySelector('.dragging');
                    if (!dragging) return;

                    const notDragging = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
                    const nextTask = notDragging.find(task => {
                        const rect = task.getBoundingClientRect();
                        return e.clientY < rect.top + rect.height / 2;
                    });
                    
                    if (nextTask) {
                        tasksContainer.insertBefore(dragging, nextTask);
                    } else {
                        tasksContainer.appendChild(dragging);
                    }
                    
                    tasksContainer.classList.add('drag-over');
                    document.querySelectorAll('.tasks').forEach(col => {
                        if (col !== tasksContainer) col.classList.remove('drag-over');
                    });
                });

                tasksContainer.addEventListener('dragleave', () => {
                    tasksContainer.classList.remove('drag-over');
                });
            });
        }

        let columnToDelete = null;

        function openDeleteColumnModal(columnId) {
            columnToDelete = columnId;
            document.getElementById('delete-column-modal').style.display = 'flex';
        }

        function closeDeleteColumnModal() {
            document.getElementById('delete-column-modal').style.display = 'none';
            columnToDelete = null;
        }

        function confirmDeleteColumn() {
            if (columnToDelete) {
                delete boardData.boards[currentBoard].columns[columnToDelete];
                saveTasks();
                renderTasks();
                showToast('Column removed');
                closeDeleteColumnModal();
            }
        }
    </script>
</body>
</html>`;

// PIN middleware
function requirePin(req, res, next) {
    const pin = process.env.DUMBKAN_PIN;
    if (!pin || pin.length < 4 || pin.length > 10) {
        return next();
    }

    const providedPin = req.headers['x-pin'] || req.cookies.DUMBKAN_PIN;
    if (providedPin !== pin) {
        return res.status(401).json({ error: 'Invalid PIN' });
    }
    next();
}

// PIN endpoints
app.get('/api/pin-required', (req, res) => {
    const pin = process.env.DUMBKAN_PIN;
    const required = pin && pin.length >= 4 && pin.length <= 10;
    res.json({ 
        required,
        length: required ? pin.length : 0
    });
});

app.post('/api/verify-pin', (req, res) => {
    // If no PIN is set, authentication is successful
    if (!process.env.DUMBKAN_PIN || process.env.DUMBKAN_PIN.trim() === '') {
        return res.json({ success: true });
    }

    const ip = req.ip;
    
    // Check if IP is locked out
    if (isLockedOut(ip)) {
        const attempts = loginAttempts.get(ip);
        const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
        return res.status(429).json({ 
            error: `Too many attempts. Please try again in ${timeLeft} minutes.`
        });
    }

    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ error: 'Invalid PIN format' });
    }

    if (pin === process.env.DUMBKAN_PIN) {
        // Reset attempts on successful login
        resetAttempts(ip);
        
        // Set cookie and return success
        res.cookie('DUMBKAN_PIN', pin, { 
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({ success: true });
    } else {
        // Record failed attempt
        recordAttempt(ip);
        
        const attempts = loginAttempts.get(ip);
        const attemptsLeft = MAX_ATTEMPTS - attempts.count;
        
        res.status(401).json({ 
            error: 'Invalid PIN',
            attemptsLeft: Math.max(0, attemptsLeft)
        });
    }
});

// Routes
app.get('/', (req, res) => {
    const pin = process.env.DUMBKAN_PIN;
    if (!pin || pin.length < 4 || pin.length > 10) {
        return res.send(html);
    }

    const providedPin = req.headers['x-pin'] || req.cookies.DUMBKAN_PIN;
    if (!providedPin || providedPin !== pin) {
        return res.redirect('/login');
    }
    
    res.send(html);
});

app.get('/login', async (req, res) => {
    const pin = process.env.DUMBKAN_PIN;
    const isPinDisabled = !pin || pin.trim() === '';
    
    if (isPinDisabled) {
        return res.redirect('/');
    }

    const providedPin = req.headers['x-pin'];
    if (providedPin === pin) {
        return res.redirect('/');
    }

    // Send login page HTML
    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DumbKan</title>
        <style>
            :root {
                --background: #ffffff;
                --container: #f5f5f5;
                --border: #e0e0e0;
                --text: #333333;
                --primary: #2196F3;
                --primary-hover: #1976D2;
                --shadow: 0 2px 4px rgba(0,0,0,0.1);
                --border-radius: 8px;
                --transition: 0.2s ease;
            }
            
            @media (prefers-color-scheme: dark) {
                :root {
                    --background: #1a1a1a;
                    --container: #2d2d2d;
                    --border: #404040;
                    --text: #ffffff;
                }
            }
            
            body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background: var(--background);
                color: var(--text);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .login-container {
                background: var(--container);
                padding: 2rem;
                border-radius: 16px;
                box-shadow: var(--shadow);
                text-align: center;
            }
            
            h1 {
                margin: 0 0 1.5rem 0;
                color: var(--text);
            }
            
            .pin-form {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                align-items: center;
            }
            
            .pin-input-container {
                display: flex;
                gap: 0.75rem;
                margin: 1rem 0;
            }
            
            .pin-input {
                width: 35px;
                height: 45px;
                text-align: center;
                font-size: 1.25rem;
                border: 2px solid var(--border);
                border-radius: 8px;
                background: var(--container);
                color: var(--text);
                transition: all var(--transition);
            }
            
            .pin-input.has-value {
                background: var(--primary);
                border-color: var(--primary);
                color: white;
            }
            
            .pin-input:disabled {
                background-color: var(--border);
                border-color: var(--border);
                color: var(--text);
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .pin-error {
                color: #f44336;
                margin: 0;
                font-size: 0.9rem;
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h1>DumbKan</h1>
            <form id="pin-form" class="pin-form">
                <h2>Enter PIN</h2>
                <div class="pin-input-container">
                </div>
                <p id="pin-error" class="pin-error">Invalid PIN. Please try again.</p>
            </form>
        </div>
        <script>
            // Check if PIN is required and get length
            async function checkPinRequired() {
                const response = await fetch('/api/pin-required');
                const { required, length } = await response.json();
                if (required) {
                    const container = document.querySelector('.pin-input-container');
                    container.innerHTML = ''; // Clear existing inputs
                    
                    // Create inputs based on PIN length
                    for (let i = 0; i < length; i++) {
                        const input = document.createElement('input');
                        input.type = 'password';
                        input.className = 'pin-input';
                        input.maxLength = 1;
                        input.pattern = '[0-9]';
                        input.inputMode = 'numeric';
                        input.required = true;
                        container.appendChild(input);
                    }
                    
                    setupPinInputs();
                    document.querySelector('.pin-input').focus();
                } else {
                    window.location.href = '/';
                }
            }

            function setupPinInputs() {
                document.querySelectorAll('.pin-input').forEach((input, index, inputs) => {
                    input.addEventListener('input', (e) => {
                        if (e.target.value) {
                            e.target.classList.add('has-value');
                            if (index < inputs.length - 1) {
                                inputs[index + 1].focus();
                            } else {
                                document.getElementById('pin-form').requestSubmit();
                            }
                        } else {
                            e.target.classList.remove('has-value');
                        }
                    });

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && !e.target.value && index > 0) {
                            const prevInput = inputs[index - 1];
                            prevInput.value = '';
                            prevInput.classList.remove('has-value');
                            prevInput.focus();
                        }
                    });
                });
            }

            document.getElementById('pin-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const inputs = [...document.querySelectorAll('.pin-input')];
                const pin = inputs.map(input => input.value).join('');

                            try {
                                const response = await fetch('/api/verify-pin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pin })
                                });
                                
                                const data = await response.json();
                                
                                if (response.ok) {
                                    window.location.href = '/';
                                } else {
                                    const errorElement = document.getElementById('pin-error');
                                    if (response.status === 429) {
                                        errorElement.textContent = data.error;
                                    } else {
                                        const msg = 'Invalid PIN. ' + data.attemptsLeft + ' attempts remaining';
                                        errorElement.textContent = msg;
                                    }
                                    errorElement.style.display = 'block';
                                    
                                    // Reset all PIN input boxes
                                    const pinInputs = document.querySelectorAll('.pin-input');
                                    pinInputs.forEach(input => {
                                        input.value = '';
                                        input.classList.remove('has-value');
                                    });
                                    // Focus the first input box
                                    pinInputs[0].focus();
                                }
                            } catch (error) {
                                console.error('Error verifying PIN:', error);
                                document.getElementById('pin-error').style.display = 'block';
                            }
                });

            checkPinRequired();
        </script>
    </body>
    </html>`);
});

app.get('/data/tasks.json', requirePin, async (_, res) => {
    try {
        const data = await fs.readFile('data/tasks.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading tasks:', error);
        res.status(500).json({ error: 'Failed to read tasks' });
    }
});

app.post('/data/tasks.json', requirePin, async (req, res) => {
    try {
        await fs.writeFile('data/tasks.json', JSON.stringify(req.body, null, 2));
        res.json({ ok: true });
    } catch (error) {
        console.error('Error saving tasks:', error);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Start server
app.listen(process.env.PORT || 3000, () => {
    console.log(`Running on port ${process.env.PORT || 3000}`);
    if (process.env.DUMBKAN_PIN) {
        console.log('PIN protection enabled');
    }
}); 