// routes/policies.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const AlertPolicy = require('../models/AlertPolicy');
const OnCallSchedule = require('../models/OnCallSchedule');

// ===== ALERT POLICY ROUTES =====

// Get all alert policies
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { monitorId, teamId, enabled } = req.query;

        const query = {};

        if (monitorId) query.monitorId = monitorId;
        if (teamId) query.teamId = teamId;
        if (enabled !== undefined) query.enabled = enabled === 'true';

        const policies = await AlertPolicy.find(query)
            .populate('monitorId', 'name url')
            .populate('teamId', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(policies);
    } catch (error) {
        console.error('Error fetching alert policies:', error);
        res.status(500).json({ 
            message: 'Error fetching alert policies', 
            error: error.message 
        });
    }
});

// Get a specific alert policy
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findById(req.params.id)
            .populate('monitorId')
            .populate('teamId')
            .populate('createdBy', 'name email')
            .populate('notificationChannels.integrationId');

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        res.json(policy);
    } catch (error) {
        console.error('Error fetching alert policy:', error);
        res.status(500).json({ 
            message: 'Error fetching alert policy', 
            error: error.message 
        });
    }
});

// Create a new alert policy
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const {
            name,
            description,
            enabled = true,
            monitorId,
            teamId,
            workspaceId,
            conditions,
            customFormula,
            severity = 'medium',
            grouping,
            escalationPolicy,
            notificationChannels,
            routing,
            predictive,
            suppressionRules,
            autoResolve,
            metadata
        } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (!conditions && !customFormula) {
            return res.status(400).json({ 
                message: 'Either conditions or customFormula is required' 
            });
        }

        const policy = new AlertPolicy({
            name,
            description,
            enabled,
            monitorId,
            teamId,
            workspaceId,
            conditions,
            customFormula,
            severity,
            grouping,
            escalationPolicy,
            notificationChannels,
            routing,
            predictive,
            suppressionRules,
            autoResolve,
            createdBy: req.user.id,
            metadata
        });

        await policy.save();

        res.status(201).json({ 
            message: 'Alert policy created successfully', 
            policy 
        });
    } catch (error) {
        console.error('Error creating alert policy:', error);
        res.status(500).json({ 
            message: 'Error creating alert policy', 
            error: error.message 
        });
    }
});

// Update an alert policy
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findById(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        const allowedUpdates = [
            'name',
            'description',
            'enabled',
            'conditions',
            'customFormula',
            'severity',
            'grouping',
            'escalationPolicy',
            'notificationChannels',
            'routing',
            'predictive',
            'suppressionRules',
            'autoResolve',
            'metadata'
        ];

        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                policy[key] = req.body[key];
            }
        }

        await policy.save();

        res.json({ 
            message: 'Alert policy updated successfully', 
            policy 
        });
    } catch (error) {
        console.error('Error updating alert policy:', error);
        res.status(500).json({ 
            message: 'Error updating alert policy', 
            error: error.message 
        });
    }
});

// Delete an alert policy
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findByIdAndDelete(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        res.json({ message: 'Alert policy deleted successfully' });
    } catch (error) {
        console.error('Error deleting alert policy:', error);
        res.status(500).json({ 
            message: 'Error deleting alert policy', 
            error: error.message 
        });
    }
});

// Test alert policy evaluation
router.post('/:id/test', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findById(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        const { checkResult, historicalData = [] } = req.body;

        if (!checkResult) {
            return res.status(400).json({ message: 'Check result is required' });
        }

        const evaluation = policy.evaluate(checkResult, historicalData);

        res.json({ 
            evaluation,
            policy: {
                name: policy.name,
                severity: policy.severity,
                conditions: policy.conditions,
                customFormula: policy.customFormula
            }
        });
    } catch (error) {
        console.error('Error testing alert policy:', error);
        res.status(500).json({ 
            message: 'Error testing alert policy', 
            error: error.message 
        });
    }
});

// ===== ON-CALL SCHEDULE ROUTES =====

// Get all on-call schedules
router.get('/oncall/schedules', ensureAuthenticated, async (req, res) => {
    try {
        const { teamId, enabled } = req.query;

        const query = {};

        if (teamId) query.teamId = teamId;
        if (enabled !== undefined) query.enabled = enabled === 'true';

        const schedules = await OnCallSchedule.find(query)
            .populate('teamId', 'name')
            .populate('createdBy', 'name email')
            .populate('rotations.users', 'name email')
            .populate('shifts.userId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(schedules);
    } catch (error) {
        console.error('Error fetching on-call schedules:', error);
        res.status(500).json({ 
            message: 'Error fetching on-call schedules', 
            error: error.message 
        });
    }
});

// Get a specific on-call schedule
router.get('/oncall/schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id)
            .populate('teamId')
            .populate('createdBy', 'name email')
            .populate('rotations.users', 'name email')
            .populate('shifts.userId', 'name email');

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        res.json(schedule);
    } catch (error) {
        console.error('Error fetching on-call schedule:', error);
        res.status(500).json({ 
            message: 'Error fetching on-call schedule', 
            error: error.message 
        });
    }
});

// Create a new on-call schedule
router.post('/oncall/schedules', ensureAuthenticated, async (req, res) => {
    try {
        const {
            name,
            description,
            teamId,
            enabled = true,
            timezone = 'UTC',
            rotations,
            shifts,
            escalationDelayMinutes,
            notificationPreferences,
            metadata
        } = req.body;

        if (!name || !teamId) {
            return res.status(400).json({ 
                message: 'Name and team ID are required' 
            });
        }

        const schedule = new OnCallSchedule({
            name,
            description,
            teamId,
            enabled,
            timezone,
            rotations,
            shifts,
            escalationDelayMinutes,
            notificationPreferences,
            createdBy: req.user.id,
            metadata
        });

        await schedule.save();

        res.status(201).json({ 
            message: 'On-call schedule created successfully', 
            schedule 
        });
    } catch (error) {
        console.error('Error creating on-call schedule:', error);
        res.status(500).json({ 
            message: 'Error creating on-call schedule', 
            error: error.message 
        });
    }
});

// Update an on-call schedule
router.put('/oncall/schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        const allowedUpdates = [
            'name',
            'description',
            'enabled',
            'timezone',
            'rotations',
            'shifts',
            'escalationDelayMinutes',
            'notificationPreferences',
            'metadata'
        ];

        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                schedule[key] = req.body[key];
            }
        }

        await schedule.save();

        res.json({ 
            message: 'On-call schedule updated successfully', 
            schedule 
        });
    } catch (error) {
        console.error('Error updating on-call schedule:', error);
        res.status(500).json({ 
            message: 'Error updating on-call schedule', 
            error: error.message 
        });
    }
});

// Delete an on-call schedule
router.delete('/oncall/schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findByIdAndDelete(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        res.json({ message: 'On-call schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting on-call schedule:', error);
        res.status(500).json({ 
            message: 'Error deleting on-call schedule', 
            error: error.message 
        });
    }
});

// Get current on-call user
router.get('/oncall/schedules/:id/current', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id)
            .populate('teamId', 'name');

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        const onCallUserId = schedule.getCurrentOnCall();

        if (!onCallUserId) {
            return res.json({ 
                schedule: {
                    _id: schedule._id,
                    name: schedule.name,
                    teamId: schedule.teamId
                },
                onCallUser: null,
                message: 'No user currently on call'
            });
        }

        const User = require('../models/User');
        const onCallUser = await User.findById(onCallUserId).select('name email');

        res.json({ 
            schedule: {
                _id: schedule._id,
                name: schedule.name,
                teamId: schedule.teamId
            },
            onCallUser,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting current on-call user:', error);
        res.status(500).json({ 
            message: 'Error getting current on-call user', 
            error: error.message 
        });
    }
});

// Add override shift
router.post('/oncall/schedules/:id/overrides', ensureAuthenticated, async (req, res) => {
    try {
        const { userId, startTime, endTime, notes } = req.body;

        if (!userId || !startTime || !endTime) {
            return res.status(400).json({ 
                message: 'User ID, start time, and end time are required' 
            });
        }

        const schedule = await OnCallSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        await schedule.addOverride(userId, new Date(startTime), new Date(endTime), notes);

        res.json({ 
            message: 'Override shift added successfully', 
            schedule 
        });
    } catch (error) {
        console.error('Error adding override shift:', error);
        res.status(500).json({ 
            message: 'Error adding override shift', 
            error: error.message 
        });
    }
});

// Get upcoming shifts
router.get('/oncall/schedules/:id/upcoming', ensureAuthenticated, async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const schedule = await OnCallSchedule.findById(req.params.id)
            .populate('shifts.userId', 'name email');

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        const upcomingShifts = schedule.getUpcomingShifts(parseInt(days));

        res.json({ 
            schedule: {
                _id: schedule._id,
                name: schedule.name
            },
            upcomingShifts,
            days: parseInt(days)
        });
    } catch (error) {
        console.error('Error getting upcoming shifts:', error);
        res.status(500).json({ 
            message: 'Error getting upcoming shifts', 
            error: error.message 
        });
    }
});

module.exports = router;
