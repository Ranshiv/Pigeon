const mongoose = require('mongoose');

// A connection records only metadata for a user-selected local repository.
// Secrets and Git credentials stay with the user's local Git installation.
const gitCollectionConnectionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true, index: true },
    repositoryPath: { type: String, required: true },
    relativeCollectionPath: { type: String, required: true },
    defaultBranch: { type: String, default: '' },
    settings: {
        includeWorkflows: { type: Boolean, default: true },
        includeEnvironmentTemplates: { type: Boolean, default: true }
    },
    lastSync: {
        databaseHash: { type: String, default: '' },
        filesystemHash: { type: String, default: '' },
        commitHash: { type: String, default: '' },
        direction: { type: String, enum: ['export', 'import', 'sync', ''], default: '' },
        at: { type: Date, default: null }
    }
}, { timestamps: true });

gitCollectionConnectionSchema.index({ userId: 1, collectionId: 1 }, { unique: true });

module.exports = mongoose.model('GitCollectionConnection', gitCollectionConnectionSchema);
