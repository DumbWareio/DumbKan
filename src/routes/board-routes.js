const express = require('express');
const { 
    readData, 
    writeData, 
    generateBoardId, 
    generateUniqueSectionId 
} = require('../utils/data-operations');
const BASE_PATH = require('../config/base-path');
const auth = require('../middleware/auth');

const router = express.Router();

// Create new board
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Board name is required' });
        }

        const data = await readData();
        const boardId = generateBoardId();
        
        // Create default sections with unique IDs
        const defaultSections = [
            { name: 'To Do' },
            { name: 'Doing' },
            { name: 'Done' }
        ];

        const sectionOrder = [];
        
        // Create unique sections for this board
        defaultSections.forEach(section => {
            const sectionId = generateUniqueSectionId();
            sectionOrder.push(sectionId);
            
            data.sections[sectionId] = {
                id: sectionId,
                name: section.name,
                boardId: boardId,
                taskIds: []
            };
        });

        // Create board with the unique section order
        data.boards[boardId] = {
            id: boardId,
            name,
            sectionOrder
        };

        await writeData(data);
        res.json({ id: boardId, ...data.boards[boardId] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create board' });
    }
});

// Get all boards
router.get('/', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load boards' });
    }
});

// Set active board
router.post('/active', async (req, res) => {
    try {
        const { boardId } = req.body;
        const data = await readData();
        
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        data.activeBoard = boardId;
        await writeData(data);
        res.json({ activeBoard: boardId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set active board' });
    }
});

// Update board name
router.put('/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Board name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Update board name
        data.boards[boardId].name = name;
        await writeData(data);
        res.json(data.boards[boardId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update board' });
    }
});

// Delete board
router.delete('/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const data = await readData();

        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Delete all sections and their tasks for this board
        Object.entries(data.sections).forEach(([sectionId, section]) => {
            if (section.boardId === boardId) {
                // Delete all tasks in the section
                if (Array.isArray(section.taskIds)) {
                    section.taskIds.forEach(taskId => {
                        delete data.tasks[taskId];
                    });
                }
                // Delete the section
                delete data.sections[sectionId];
            }
        });

        // Delete the board
        delete data.boards[boardId];

        // If this was the active board, switch to another board
        if (data.activeBoard === boardId) {
            const remainingBoards = Object.keys(data.boards);
            data.activeBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
        }

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete board' });
    }
});

module.exports = router; 