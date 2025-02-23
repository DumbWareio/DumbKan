const express = require('express');
const { 
    readData, 
    writeData
} = require('../utils/data-operations');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Add auth middleware to all routes
router.use(authMiddleware);

// Debug middleware for tracking route usage
router.use((req, res, next) => {
    console.log('🔍 Standalone Task Routes - Debug Info:', {
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        method: req.method,
        params: req.params,
        body: req.body,
        authenticated: req.session?.authenticated
    });
    next();
});

// Update task
router.put('/:taskId', async (req, res) => {
    console.log('🎯 Hitting standalone task update route:', {
        taskId: req.params.taskId,
        updates: req.body
    });
    try {
        const { taskId } = req.params;
        const updates = req.body;

        const data = await readData();
        const task = data.tasks[taskId];

        if (!task) {
            console.log('❌ Task not found:', taskId);
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
        console.log('✅ Task updated successfully:', task);
        res.json(task);
    } catch (error) {
        console.error('❌ Standalone task update error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Move task
router.post('/:taskId/move', async (req, res) => {
    console.log('Hitting standalone task move route');
    try {
        const { taskId } = req.params;
        const { toSectionId, newIndex } = req.body;

        if (!toSectionId) {
            return res.status(400).json({ error: 'Target section ID is required' });
        }

        const data = await readData();
        const task = data.tasks[taskId];

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const fromSectionId = task.sectionId;

        // Validate sections exist
        if (!data.sections[fromSectionId] || !data.sections[toSectionId]) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove task from source section
        const fromTaskIds = data.sections[fromSectionId].taskIds;
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
                [fromSectionId]: data.sections[fromSectionId],
                [toSectionId]: data.sections[toSectionId]
            }
        });
    } catch (error) {
        console.error('Standalone task move error:', error);
        res.status(500).json({ error: 'Failed to move task' });
    }
});

// Delete task
router.delete('/:taskId', async (req, res) => {
    console.log('Hitting standalone task delete route');
    try {
        const { taskId } = req.params;
        const data = await readData();
        
        const task = data.tasks[taskId];
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const section = data.sections[task.sectionId];
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Remove task ID from section
        const taskIndex = section.taskIds.indexOf(taskId);
        if (taskIndex !== -1) {
            section.taskIds.splice(taskIndex, 1);
        }
        
        // Delete task from tasks collection
        delete data.tasks[taskId];

        await writeData(data);
        res.json({ success: true });
    } catch (error) {
        console.error('Standalone task delete error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

module.exports = router; 