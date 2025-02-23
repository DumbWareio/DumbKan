const express = require('express');
const { 
    readData, 
    writeData 
} = require('../utils/data-operations');

const router = express.Router({ mergeParams: true });

// Move task between sections
router.post('/', async (req, res) => {
    try {
        const { boardId, taskId } = req.params;
        const { fromSectionId, toSectionId, newIndex } = req.body;

        const data = await readData();
        
        // Validate board and sections exist
        if (!data.sections[fromSectionId] || !data.sections[toSectionId]) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove task from source section
        const fromTaskIds = data.sections[fromSectionId].taskIds;
        const taskIndex = fromTaskIds.indexOf(taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }
        fromTaskIds.splice(taskIndex, 1);

        // Add task to target section
        const toTaskIds = data.sections[toSectionId].taskIds;
        if (typeof newIndex === 'number') {
            toTaskIds.splice(newIndex, 0, taskId);
        } else {
            toTaskIds.push(taskId);
        }

        // Update task's section reference
        data.tasks[taskId].sectionId = toSectionId;
        data.tasks[taskId].updatedAt = new Date().toISOString();

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move task' });
    }
});

module.exports = router; 