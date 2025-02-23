const express = require('express');
const { 
    readData, 
    writeData, 
    generateBoardId, 
    generateUniqueSectionId 
} = require('../utils/data-operations');

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

module.exports = router; 