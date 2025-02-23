const express = require('express');
const { 
    readData, 
    writeData, 
    generateUniqueSectionId 
} = require('../utils/data-operations');
const BASE_PATH = require('../config/base-path');

const router = express.Router({ mergeParams: true });

// Add section to board
router.post('/', async (req, res) => {
    try {
        const { boardId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Section name is required' });
        }

        const data = await readData();
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        const sectionId = generateUniqueSectionId();
        
        // Create new section
        data.sections[sectionId] = {
            id: sectionId,
            name,
            boardId,
            taskIds: []
        };

        // Add section to board's section order
        data.boards[boardId].sectionOrder.push(sectionId);

        await writeData(data);
        res.json(data.sections[sectionId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create section' });
    }
});

// Move section within board
router.post('/:sectionId/move', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { newIndex } = req.body;

        const data = await readData();
        const board = data.boards[boardId];
        
        if (!board) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // Remove section from current position
        const currentIndex = board.sectionOrder.indexOf(sectionId);
        if (currentIndex === -1) {
            return res.status(404).json({ error: 'Section not found in board' });
        }
        board.sectionOrder.splice(currentIndex, 1);

        // Insert section at new position
        board.sectionOrder.splice(newIndex, 0, sectionId);

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move section' });
    }
});

// Update section name
router.put('/:sectionId', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Section name is required' });
        }

        const data = await readData();
        if (!data.sections[sectionId] || data.sections[sectionId].boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Update section name
        data.sections[sectionId].name = name;
        await writeData(data);
        res.json(data.sections[sectionId]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update section' });
    }
});

// Delete section
router.delete('/:sectionId', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const data = await readData();

        // Verify board and section exist
        if (!data.boards[boardId]) {
            return res.status(404).json({ error: 'Board not found' });
        }

        const section = data.sections[sectionId];
        if (!section || section.boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove section from board's sectionOrder
        const board = data.boards[boardId];
        const sectionIndex = board.sectionOrder.indexOf(sectionId);
        if (sectionIndex !== -1) {
            board.sectionOrder.splice(sectionIndex, 1);
        }

        // Delete all tasks in the section
        if (Array.isArray(section.taskIds)) {
            section.taskIds.forEach(taskId => {
                delete data.tasks[taskId];
            });
        }

        // Delete the section
        delete data.sections[sectionId];

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

module.exports = router; 