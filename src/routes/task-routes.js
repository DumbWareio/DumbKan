const express = require('express');
const { 
    readData, 
    writeData, 
    generateTaskId 
} = require('../utils/data-operations');

const router = express.Router({ mergeParams: true });

// Debug middleware to log route matching
router.use((req, res, next) => {
    console.log('Task Routes - Request URL:', req.originalUrl);
    console.log('Task Routes - Base URL:', req.baseUrl);
    console.log('Task Routes - Path:', req.path);
    console.log('Task Routes - Params:', req.params);
    console.log('Task Routes - Body:', req.body);
    next();
});

// Add task to section
router.post('/', async (req, res) => {
    console.log('Hitting task creation route');
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