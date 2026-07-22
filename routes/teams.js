// routes/teams.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');
const EmailService = require('../services/EmailService');

// Compliance audit logging (who changed what)
const AuditLogger = require('../features/compliance/AuditLogger');

// Get all teams for the authenticated user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const teams = await Team.find({
            $or: [
                { ownerId: req.user.id },
                { 'members.userId': req.user.id }
            ]
        })
            .populate('members.userId', 'displayName email')
            .populate('ownerId', 'displayName email')
            .sort({ createdAt: -1 });

        // Add user role for each team
        const teamsWithRole = teams.map(team => {
            let userRole = 'member';
            if (team.ownerId._id.toString() === req.user.id) {
                userRole = 'owner';
            } else {
                const member = team.members.find(m => m.userId._id.toString() === req.user.id);
                if (member) {
                    userRole = member.role;
                }
            }

            return {
                ...team.toObject(),
                userRole
            };
        });

        res.json(teamsWithRole);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams', error: error.message });
    }
});

// Get specific team
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('members.userId', 'displayName email')
            .populate('ownerId', 'displayName email');

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check if user has access to this team
        const hasAccess = team.ownerId._id.toString() === req.user.id ||
            team.members.some(m => m.userId._id.toString() === req.user.id);

        if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(team);
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ message: 'Error fetching team', error: error.message });
    }
});

// Create new team
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description, defaultRole = 'viewer' } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Team name is required' });
        }

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

        const team = new Team({
            name,
            description,
            workspaceId: workspace._id.toString(),
            ownerId: req.user.id,
            members: [{
                userId: req.user.id,
                role: 'owner',
                permissions: [
                    'manage_monitors',
                    'view_monitors',
                    'manage_incidents',
                    'view_incidents',
                    'manage_team',
                    'view_reports',
                    'manage_integrations',
                    'manage_maintenance'
                ]
            }]
        });

        await team.save();

        // Audit log: team created
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.create',
                targetType: 'team',
                targetId: team._id,
                metadata: { name: team.name }
            });
        } catch (e) {
            console.warn('Audit log failed (team create):', e.message);
        }

        // Populate the response
        await team.populate([
            { path: 'ownerId', select: 'displayName email' },
            { path: 'members.userId', select: 'displayName email' }
        ]);

        res.status(201).json(team);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ message: 'Error creating team', error: error.message });
    }
});

// Update team
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check if user is owner or admin
        const hasPermission = team.ownerId.toString() === req.user.id ||
            team.members.some(m =>
                m.userId.toString() === req.user.id &&
                (m.role === 'admin' || m.role === 'owner')
            );

        if (!hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        const { name, description, settings } = req.body;

        if (name) team.name = name;
        if (description !== undefined) team.description = description;
        if (settings) team.settings = { ...team.settings, ...settings };

        team.updatedAt = new Date();
        await team.save();

        // Audit log: team updated
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.update',
                targetType: 'team',
                targetId: team._id,
                metadata: {
                    fields: { name, description, settings }
                }
            });
        } catch (e) {
            console.warn('Audit log failed (team update):', e.message);
        }

        await team.populate('members.userId', 'displayName email');
        await team.populate('ownerId', 'displayName email');

        res.json(team);
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ message: 'Error updating team', error: error.message });
    }
});

// Delete team
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Only owner can delete team
        if (team.ownerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only team owner can delete the team' });
        }

        await Team.findByIdAndDelete(req.params.id);

        // Audit log: team deleted
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.delete',
                targetType: 'team',
                targetId: team._id,
                metadata: { name: team.name }
            });
        } catch (e) {
            console.warn('Audit log failed (team delete):', e.message);
        }

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ message: 'Error deleting team', error: error.message });
    }
});

// Invite member to team
router.post('/:id/invite', ensureAuthenticated, async (req, res) => {
    try {
        const { email, role = 'viewer' } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check permissions
        const hasPermission = team.ownerId.toString() === req.user.id ||
            team.members.some(m =>
                m.userId.toString() === req.user.id &&
                (m.role === 'admin' || m.role === 'owner')
            );

        if (!hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Check if user exists
        let invitedUser = await User.findOne({ email });

        if (!invitedUser) {
            return res.status(404).json({ message: 'User not found with this email' });
        }

        // Check if user is already a member
        const isAlreadyMember = team.members.some(m =>
            m.userId.toString() === invitedUser._id.toString()
        );

        if (isAlreadyMember) {
            return res.status(400).json({ message: 'User is already a member of this team' });
        }

        // Add member to team
        team.members.push({
            userId: invitedUser._id,
            role,
            joinedAt: new Date()
        });

        await team.save();

        // Audit log: team member invited
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.member.invite',
                targetType: 'team',
                targetId: team._id,
                metadata: { invitedEmail: email, role }
            });
        } catch (e) {
            console.warn('Audit log failed (team invite):', e.message);
        }

        // Send invitation email
        try {
            const emailService = new EmailService();
            await emailService.sendTeamInvitation(
                invitedUser.email,
                team.name,
                req.user.displayName || req.user.email,
                role
            );
        } catch (emailError) {
            console.error('Error sending invitation email:', emailError);
            // Continue without failing the request
        }

        await team.populate('members.userId', 'displayName email');
        await team.populate('ownerId', 'displayName email');

        res.json(team);
    } catch (error) {
        console.error('Error inviting member:', error);
        res.status(500).json({ message: 'Error inviting member', error: error.message });
    }
});

// Update member role
router.put('/:id/members/:memberId/role', ensureAuthenticated, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['viewer', 'editor', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check permissions
        const hasPermission = team.ownerId.toString() === req.user.id ||
            team.members.some(m =>
                m.userId.toString() === req.user.id &&
                m.role === 'admin'
            );

        if (!hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Find and update member
        const member = team.members.find(m => m._id.toString() === req.params.memberId);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        member.role = role;
        team.updatedAt = new Date();

        await team.save();

        // Audit log: member role changed
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.member.role.update',
                targetType: 'team',
                targetId: team._id,
                metadata: { memberId: req.params.memberId, role }
            });
        } catch (e) {
            console.warn('Audit log failed (team member role update):', e.message);
        }

        await team.populate('members.userId', 'displayName email');
        await team.populate('ownerId', 'displayName email');

        res.json(team);
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({ message: 'Error updating member role', error: error.message });
    }
});

// Remove member from team
router.delete('/:id/members/:memberId', ensureAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check permissions (owner, admin, or the member themselves)
        const member = team.members.find(m => m._id.toString() === req.params.memberId);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const hasPermission = team.ownerId.toString() === req.user.id ||
            team.members.some(m =>
                m.userId.toString() === req.user.id &&
                m.role === 'admin'
            ) ||
            member.userId.toString() === req.user.id;

        if (!hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Remove member
        team.members = team.members.filter(m => m._id.toString() !== req.params.memberId);
        team.updatedAt = new Date();

        await team.save();

        // Audit log: member removed
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: team.workspaceId,
                action: 'team.member.remove',
                targetType: 'team',
                targetId: team._id,
                metadata: { memberId: req.params.memberId }
            });
        } catch (e) {
            console.warn('Audit log failed (team member remove):', e.message);
        }

        await team.populate('members.userId', 'displayName email');
        await team.populate('ownerId', 'displayName email');

        res.json(team);
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Error removing member', error: error.message });
    }
});

module.exports = router;
