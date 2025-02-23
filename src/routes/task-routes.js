const express = require('express');
const { 
    readData, 
    writeData, 
    generateTaskId 
} = require('../utils/data-operations');

const router = express.Router({ mergeParams: true });

// Add task to section
router.post('/', async (req, res) => {
    try {
        const { boardId, sectionId } = req.params;
        const { title, description, priority = 'medium', dueDate = null, startDate = null } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        // Validate priority
        const validPriorities = ['urgent', 'high', 'medium', 'low'];
        const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

        const data = await readData();
        if (!data.sections[sectionId] || data.sections[sectionId].boardId !== boardId) {
            return res.status(404).json({ error: 'Board or section not found' });
        }

        const taskId = generateTaskId();
        const now = new Date().toISOString();

        // Create new task with validated priority and optional dates
        const task = {
            id: taskId,
            title,
            description: description || '',
            createdAt: now,
            updatedAt: now,
            sectionId,
            boardId,
            priority: taskPriority,
            status: 'active',
            tags: [],
            assignee: null,
            dueDate,
            startDate
        };

        // Add task to tasks collection
        data.tasks[taskId] = task;

        // Add task ID to section
        data.sections[sectionId].taskIds.push(taskId);

        await writeData(data);
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

module.exports = router; 