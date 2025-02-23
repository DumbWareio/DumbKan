const express = require('express');
const { 
    readData, 
    writeData, 
    generateUniqueSectionId 
} = require('../utils/data-operations');

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

module.exports = router; 