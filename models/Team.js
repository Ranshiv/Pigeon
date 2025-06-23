// models/Team.js
const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['owner', 'admin', 'member', 'viewer'],
        default: 'member'
    },
    permissions: [{
        type: String,
        enum: [
            'manage_monitors',
            'view_monitors',
            'manage_incidents',
            'view_incidents',
            'manage_team',
            'view_reports',
            'manage_integrations',
            'manage_maintenance'
        ]
    }],
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [teamMemberSchema],
    alertRouting: {
        defaultChannel: {
            type: String,
            enum: ['email', 'slack', 'teams', 'pagerduty'],
            default: 'email'
        },
        escalationPolicy: [{
            step: Number,
            delayMinutes: Number,
            channels: [String],
            users: [mongoose.Schema.Types.ObjectId]
        }]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

teamSchema.index({ workspaceId: 1 });
teamSchema.index({ ownerId: 1 });
teamSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Team', teamSchema);
