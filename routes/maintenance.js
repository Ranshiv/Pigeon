// routes/maintenance.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const StatusPageSubscription = require('../models/StatusPageSubscription');
const EmailService = require('../services/EmailService');
const cron = require('node-cron');

// Get all maintenance windows for workspace
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, status } = req.query;
        const query = { userId: req.user.id };

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        if (status) {
            query.status = status;
        }

        const maintenanceWindows = await MaintenanceWindow.find(query)
            .populate('affectedServices.monitorId', 'name url')
            .sort({ scheduledStartTime: -1 });

        res.json(maintenanceWindows);
    } catch (error) {
        console.error('Error fetching maintenance windows:', error);
        res.status(500).json({ message: 'Error fetching maintenance windows', error: error.message });
    }
});

// Get specific maintenance window
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const maintenanceWindow = await MaintenanceWindow.findOne({
            _id: req.params.id,
            userId: req.user.id
        }).populate('affectedServices.monitorId', 'name url');

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found' });
        }

        res.json(maintenanceWindow);
    } catch (error) {
        console.error('Error fetching maintenance window:', error);
        res.status(500).json({ message: 'Error fetching maintenance window', error: error.message });
    }
});

// Create new maintenance window
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        // Validate required fields
        const { title, description, scheduledStartTime, scheduledEndTime, affectedServices } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                message: 'Title and description are required'
            });
        }

        if (!scheduledStartTime || !scheduledEndTime) {
            return res.status(400).json({
                message: 'Scheduled start time and end time are required'
            });
        }

        // Validate dates
        const startDate = new Date(scheduledStartTime);
        const endDate = new Date(scheduledEndTime);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                message: 'Invalid date format for scheduled times'
            });
        }

        if (startDate >= endDate) {
            return res.status(400).json({
                message: 'Scheduled end time must be after start time'
            });
        }

        if (startDate < new Date()) {
            return res.status(400).json({
                message: 'Scheduled start time cannot be in the past'
            });
        }

        // Get or create default workspace for user
        const { getDb } = require('../config/db');
        const db = getDb();

        let workspace = await db.collection('workspaces').findOne({
            owner: req.user.id,
            isPersonal: true
        });

        // If no personal workspace exists, create one
        if (!workspace) {
            const newWorkspace = {
                name: 'Personal Workspace',
                description: 'Your personal workspace',
                owner: req.user.id,
                isPersonal: true,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('workspaces').insertOne(newWorkspace);
            workspace = { ...newWorkspace, _id: result.insertedId };
        }

        const maintenanceData = {
            title,
            description,
            scheduledStartTime: startDate,
            scheduledEndTime: endDate,
            affectedServices: affectedServices || [],
            status: req.body.status || 'scheduled',
            isRecurring: req.body.isRecurring || false,
            recurrencePattern: req.body.recurrencePattern,
            notificationSettings: req.body.notificationSettings,
            userId: req.user.id,
            workspaceId: workspace._id.toString()
        };

        const maintenanceWindow = new MaintenanceWindow(maintenanceData);
        await maintenanceWindow.save();

        // Schedule notification reminders
        await scheduleMaintenanceNotifications(maintenanceWindow);

        res.status(201).json(maintenanceWindow);
    } catch (error) {
        console.error('Error creating maintenance window:', error);
        res.status(400).json({ message: 'Error creating maintenance window', error: error.message });
    }
});

// Update maintenance window
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const maintenanceWindow = await MaintenanceWindow.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        ).populate('affectedServices.monitorId', 'name url');

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found' });
        }

        // Reschedule notifications if times changed
        if (req.body.scheduledStartTime || req.body.scheduledEndTime) {
            await scheduleMaintenanceNotifications(maintenanceWindow);
        }

        res.json(maintenanceWindow);
    } catch (error) {
        console.error('Error updating maintenance window:', error);
        res.status(400).json({ message: 'Error updating maintenance window', error: error.message });
    }
});

// Delete maintenance window
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const maintenanceWindow = await MaintenanceWindow.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found' });
        }

        res.json({ message: 'Maintenance window deleted successfully' });
    } catch (error) {
        console.error('Error deleting maintenance window:', error);
        res.status(500).json({ message: 'Error deleting maintenance window', error: error.message });
    }
});

// Start maintenance
router.post('/:id/start', ensureAuthenticated, async (req, res) => {
    try {
        const maintenanceWindow = await MaintenanceWindow.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
                status: 'scheduled'
            },
            {
                status: 'in_progress',
                actualStartTime: new Date()
            },
            { new: true }
        ).populate('affectedServices.monitorId', 'name url');

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found or already started' });
        }

        // Send start notification
        await sendMaintenanceNotification(maintenanceWindow, 'started');

        res.json(maintenanceWindow);
    } catch (error) {
        console.error('Error starting maintenance:', error);
        res.status(500).json({ message: 'Error starting maintenance', error: error.message });
    }
});

// Complete maintenance
router.post('/:id/complete', ensureAuthenticated, async (req, res) => {
    try {
        const maintenanceWindow = await MaintenanceWindow.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
                status: 'in_progress'
            },
            {
                status: 'completed',
                actualEndTime: new Date()
            },
            { new: true }
        ).populate('affectedServices.monitorId', 'name url');

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found or not in progress' });
        }

        // Send completion notification
        await sendMaintenanceNotification(maintenanceWindow, 'completed');

        res.json(maintenanceWindow);
    } catch (error) {
        console.error('Error completing maintenance:', error);
        res.status(500).json({ message: 'Error completing maintenance', error: error.message });
    }
});

// Add update to maintenance window
router.post('/:id/updates', ensureAuthenticated, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Update message is required' });
        }

        const maintenanceWindow = await MaintenanceWindow.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            {
                $push: {
                    updates: {
                        message,
                        userId: req.user.id,
                        timestamp: new Date()
                    }
                }
            },
            { new: true }
        ).populate('affectedServices.monitorId', 'name url');

        if (!maintenanceWindow) {
            return res.status(404).json({ message: 'Maintenance window not found' });
        }

        res.json(maintenanceWindow);
    } catch (error) {
        console.error('Error adding maintenance update:', error);
        res.status(500).json({ message: 'Error adding maintenance update', error: error.message });
    }
});

// Get public maintenance windows (for status page)
router.get('/public/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const now = new Date();

        // Get upcoming and active maintenance windows
        const maintenanceWindows = await MaintenanceWindow.find({
            workspaceId,
            status: { $in: ['scheduled', 'in_progress'] },
            scheduledEndTime: { $gte: now }
        })
            .populate('affectedServices.monitorId', 'name')
            .sort({ scheduledStartTime: 1 });

        // Format for public display
        const publicMaintenance = maintenanceWindows.map(mw => ({
            id: mw._id,
            title: mw.title,
            description: mw.description,
            status: mw.status,
            scheduledStartTime: mw.scheduledStartTime,
            scheduledEndTime: mw.scheduledEndTime,
            actualStartTime: mw.actualStartTime,
            affectedServices: mw.affectedServices.map(service => ({
                name: service.serviceName || (service.monitorId ? service.monitorId.name : 'Unknown Service')
            })),
            updates: mw.updates.map(update => ({
                message: update.message,
                timestamp: update.timestamp
            }))
        }));

        res.json(publicMaintenance);
    } catch (error) {
        console.error('Error fetching public maintenance windows:', error);
        res.status(500).json({ message: 'Error fetching maintenance windows', error: error.message });
    }
});

// Helper functions
async function scheduleMaintenanceNotifications(maintenanceWindow) {
    if (!maintenanceWindow.notificationSettings.notifySubscribers) {
        return;
    }

    const { reminderMinutes } = maintenanceWindow.notificationSettings;
    const startTime = new Date(maintenanceWindow.scheduledStartTime);

    // Schedule reminders
    for (const minutes of reminderMinutes) {
        const reminderTime = new Date(startTime.getTime() - (minutes * 60 * 1000));

        if (reminderTime > new Date()) {
            // In a production system, you'd use a proper job scheduler like Bull or Agenda
            // For now, we'll use setTimeout for demo purposes (not persistent across restarts)
            const delay = reminderTime.getTime() - Date.now();

            setTimeout(async () => {
                await sendMaintenanceNotification(maintenanceWindow, 'reminder');
            }, delay);
        }
    }
}

async function sendMaintenanceNotification(maintenanceWindow, type) {
    try {
        // Get subscribers for this workspace
        const subscribers = await StatusPageSubscription.find({
            workspaceId: maintenanceWindow.workspaceId,
            isActive: true,
            isVerified: true,
            subscriptionTypes: 'maintenance_windows'
        });

        if (subscribers.length === 0) {
            console.log('No subscribers found for maintenance notification');
            return;
        }

        const emailService = new EmailService();
        await emailService.sendMaintenanceNotification({
            subscribers,
            maintenance: maintenanceWindow,
            type
        });

        console.log(`Maintenance notification (${type}) sent to ${subscribers.length} subscribers`);
    } catch (error) {
        console.error('Error sending maintenance notification:', error);
    }
}

module.exports = router;
