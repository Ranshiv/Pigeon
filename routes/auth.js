// routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

// List of allowed profile icons for validation
const allowedIcons = [
    'buffalo.png', 'clown-fish.png', 'hippo.png',
    'lion.png', 'mouse.png', 'pig.png', 'sheep.png'
];

// Google Auth routes
router.get('/google',
    (req, res, next) => {
        console.log("Reached /auth/google route handler!"); // Debugging log
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
    });

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }), // Redirect to public home on failure
    (req, res) => {
        // Successful authentication, redirect to the workspace.
        res.redirect('http://localhost:3000/workspace');
    }
);

// Auth check route
router.get('/check', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error: ', err)
                return res.status(500).json({ message: 'Logout Failed' })
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// User profile update route
router.put('/user/profile', ensureAuthenticated, async (req, res) => {
    try {
        // Include profileIcon
        const { displayName, theme, fontSize, profileIcon } = req.body;
        const userId = req.user.id;

        const updateData = {};
        if (displayName && typeof displayName === 'string' && displayName.trim() !== '') {
            updateData.displayName = displayName.trim();
        }
        if (theme && ['light', 'dark'].includes(theme)) {
            updateData.theme = theme;
        }
        if (fontSize && ['14px', '16px', '18px'].includes(fontSize)) {
            updateData.fontSize = fontSize;
        }
        // Validate and add profileIcon
        if (profileIcon && typeof profileIcon === 'string') {
            if (allowedIcons.includes(profileIcon)) {
                updateData.profileIcon = profileIcon;
            } else {
                console.warn(`Invalid profileIcon received: ${profileIcon}`);
                // Optionally return a specific error, or just ignore it
                // return res.status(400).json({ message: 'Invalid profile icon selected' });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.login(updatedUser, (err) => {
            if (err) {
                console.error("Error updating session user after profile update:", err);
            }
            res.json({ message: 'Profile updated successfully', user: updatedUser });
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Get users who share a workspace with the current user (collaboration).
// If ?workspaceId= is given, scope strictly to that workspace's members
// (and only if the caller has access to it); otherwise any shared workspace.
router.get('/users/list', ensureAuthenticated, async (req, res) => {
    try {
        const Workspace = require('../models/Workspace');
        const { workspaceId } = req.query;

        const scopeQuery = workspaceId
            ? { _id: workspaceId, $or: [{ owner: req.user._id }, { 'collaborators.userId': req.user._id }] }
            : { $or: [{ owner: req.user._id }, { 'collaborators.userId': req.user._id }] };

        const workspaces = await Workspace.find(scopeQuery, 'owner collaborators.userId');

        if (workspaceId && !workspaces.length) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }

        const userIds = new Set();
        workspaces.forEach(w => {
            if (w.owner) userIds.add(String(w.owner));
            w.collaborators.forEach(c => c.userId && userIds.add(String(c.userId)));
        });
        userIds.add(String(req.user._id));

        const users = await User.find({ _id: { $in: Array.from(userIds) } }, 'displayName email profilePicture');
        res.json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

module.exports = router;