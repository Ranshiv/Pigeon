// routes/reports.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Report = require('../models/Report');
const ReportingService = require('../services/ReportingService');

// Get all reports for workspace
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const query = { userId: req.user.id };

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        const reports = await Report.find(query)
            .populate('filters.monitorIds', 'name url')
            .sort({ createdAt: -1 });

        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Error fetching reports', error: error.message });
    }
});

// Get specific report
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const report = await Report.findOne({
            _id: req.params.id,
            userId: req.user.id
        }).populate('filters.monitorIds', 'name url');

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ message: 'Error fetching report', error: error.message });
    }
});

// Create new report
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        // Get or create default workspace for user
        const { getDb } = require('../config/db');
        const db = getDb();

        const workspace = await db.collection('workspaces').findOne({
            owner: req.user.id,
            isPersonal: true
        });

        if (!workspace) {
            return res.status(400).json({ message: 'Create a personal workspace first' });
        }

        const reportData = {
            ...req.body,
            userId: req.user.id,
            workspaceId: workspace._id.toString()
        };

        // Calculate next scheduled time
        const nextScheduled = calculateNextScheduledTime(reportData.schedule);
        reportData.nextScheduled = nextScheduled;

        const report = new Report(reportData);
        await report.save();

        // Add to scheduler if active
        if (report.isActive) {
            ReportingService.scheduleReport(report);
        }

        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(400).json({ message: 'Error creating report', error: error.message });
    }
});

// Update report
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const updates = req.body;

        // Recalculate next scheduled time if schedule changed
        if (updates.schedule) {
            updates.nextScheduled = calculateNextScheduledTime(updates.schedule);
        }

        const report = await Report.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            updates,
            { new: true, runValidators: true }
        );

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Update scheduler
        if (report.isActive) {
            ReportingService.scheduleReport(report);
        }

        res.json(report);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(400).json({ message: 'Error updating report', error: error.message });
    }
});

// Delete report
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const report = await Report.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ message: 'Error deleting report', error: error.message });
    }
});

// Generate report manually
router.post('/:id/generate', ensureAuthenticated, async (req, res) => {
    try {
        const report = await Report.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Generate report in background
        ReportingService.generateReport(report)
            .then(() => console.log(`Manual report generation completed: ${report.name}`))
            .catch(err => console.error(`Manual report generation failed: ${err.message}`));

        res.json({ message: 'Report generation started. You will receive it via email shortly.' });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
});

// Get report templates
router.get('/templates/list', ensureAuthenticated, async (req, res) => {
    try {
        const templates = [
            {
                id: 'uptime_weekly',
                name: 'Weekly Uptime Report',
                description: 'Weekly summary of uptime and performance metrics',
                type: 'uptime',
                schedule: {
                    frequency: 'weekly',
                    dayOfWeek: 1, // Monday
                    time: '09:00'
                },
                template: {
                    includeExecutiveSummary: true,
                    includeUptimeCharts: true,
                    includePerformanceMetrics: true,
                    includeIncidentSummary: true,
                    includeSLACompliance: false
                }
            },
            {
                id: 'sla_monthly',
                name: 'Monthly SLA Report',
                description: 'Monthly SLA compliance and performance report',
                type: 'sla',
                schedule: {
                    frequency: 'monthly',
                    dayOfMonth: 1,
                    time: '09:00'
                },
                template: {
                    includeExecutiveSummary: true,
                    includeUptimeCharts: true,
                    includePerformanceMetrics: true,
                    includeIncidentSummary: true,
                    includeSLACompliance: true
                }
            },
            {
                id: 'performance_daily',
                name: 'Daily Performance Report',
                description: 'Daily performance and response time analysis',
                type: 'performance',
                schedule: {
                    frequency: 'daily',
                    time: '08:00'
                },
                template: {
                    includeExecutiveSummary: false,
                    includeUptimeCharts: false,
                    includePerformanceMetrics: true,
                    includeIncidentSummary: false,
                    includeSLACompliance: false
                }
            }
        ];

        res.json(templates);
    } catch (error) {
        console.error('Error fetching report templates:', error);
        res.status(500).json({ message: 'Error fetching report templates', error: error.message });
    }
});

// Helper function to calculate next scheduled time
function calculateNextScheduledTime(schedule) {
    const { frequency, dayOfWeek, dayOfMonth, time } = schedule;
    const [hour, minute] = time.split(':').map(Number);
    const now = new Date();
    let nextScheduled = new Date();

    switch (frequency) {
        case 'daily':
            nextScheduled.setDate(now.getDate() + 1);
            break;
        case 'weekly':
            const daysUntilNext = (dayOfWeek + 7 - now.getDay()) % 7 || 7;
            nextScheduled.setDate(now.getDate() + daysUntilNext);
            break;
        case 'monthly':
            nextScheduled.setMonth(now.getMonth() + 1);
            nextScheduled.setDate(dayOfMonth);
            // If the day doesn't exist in the next month, set to last day
            if (nextScheduled.getDate() !== dayOfMonth) {
                nextScheduled.setDate(0);
            }
            break;
    }

    nextScheduled.setHours(hour, minute, 0, 0);

    // If the calculated time is in the past, move to next occurrence
    if (nextScheduled <= now) {
        switch (frequency) {
            case 'daily':
                nextScheduled.setDate(nextScheduled.getDate() + 1);
                break;
            case 'weekly':
                nextScheduled.setDate(nextScheduled.getDate() + 7);
                break;
            case 'monthly':
                nextScheduled.setMonth(nextScheduled.getMonth() + 1);
                break;
        }
    }

    return nextScheduled;
}

module.exports = router;
