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

// Update task
router.put('/:taskId', async (req, res) => {
    console.log('Hitting task update route');
    try {
        const { boardId, sectionId, taskId } = req.params;
        const updates = req.body;

        const data = await readData();
        const task = data.tasks[taskId];

        if (!task || task.sectionId !== sectionId || task.boardId !== boardId) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Validate priority if provided
        if (updates.priority) {
            const validPriorities = ['urgent', 'high', 'medium', 'low'];
            updates.priority = validPriorities.includes(updates.priority) 
                ? updates.priority 
                : task.priority;
        }

        // Update task properties
        Object.assign(task, {
            ...updates,
            updatedAt: new Date().toISOString()
        });

        await writeData(data);
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Move task between sections
router.post('/:taskId/move', async (req, res) => {
    console.log('Hitting task move route with params:', req.params);
    console.log('Move request body:', req.body);
    try {
        const { boardId, sectionId, taskId } = req.params;
        const { toSectionId, newIndex } = req.body;

        if (!toSectionId) {
            return res.status(400).json({ error: 'Target section ID is required' });
        }

        const data = await readData();
        
        // Validate board and sections exist
        if (!data.sections[sectionId] || !data.sections[toSectionId]) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Validate task exists and belongs to the board
        const task = data.tasks[taskId];
        if (!task || task.boardId !== boardId) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Remove task from source section
        const fromTaskIds = data.sections[sectionId].taskIds;
        const taskIndex = fromTaskIds.indexOf(taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found in source section' });
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
        task.sectionId = toSectionId;
        task.updatedAt = new Date().toISOString();

        await writeData(data);
        res.json({ 
            success: true,
            task,
            sections: {
                [sectionId]: data.sections[sectionId],
                [toSectionId]: data.sections[toSectionId]
            }
        });
    } catch (error) {
        console.error('Task move error:', error);
        res.status(500).json({ error: 'Failed to move task' });
    }
});

// Delete task
router.delete('/:taskId', async (req, res) => {
    try {
        const { boardId, sectionId, taskId } = req.params;

        const data = await readData();
        
        // Remove task from section
        const section = data.sections[sectionId];
        if (!section || section.boardId !== boardId) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const taskIndex = section.taskIds.indexOf(taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Remove task ID from section
        section.taskIds.splice(taskIndex, 1);
        
        // Delete task from tasks collection
        delete data.tasks[taskId];

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

module.exports = router; 