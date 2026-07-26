const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../middleware/auth');
const Collection = require('../models/Collection');
const GitCollectionConnection = require('../models/GitCollectionConnection');
const { applyLocalToCollection, applyResolutions, buildExport, diffRequests, exportCollection, readLocalCollection, resolveRepository, safeRelative, sanitizeRequestForPersistence } = require('../services/GitCollectionService');

const router = express.Router();
const execFileAsync = promisify(execFile);
const userId = (req) => req.user?.id || req.user?._id;

async function editableCollection(req, collectionId) {
    if (!mongoose.Types.ObjectId.isValid(collectionId)) return null;
    const collection = await Collection.findById(collectionId);
    return collection?.hasAccess(String(userId(req)), 'editor') ? collection : null;
}

async function gitStatus(repositoryPath) {
    try {
        const [{ stdout: root }, { stdout: branch }, { stdout: commit }, { stdout: status }] = await Promise.all([
            execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: repositoryPath, timeout: 5000 }),
            execFileAsync('git', ['branch', '--show-current'], { cwd: repositoryPath, timeout: 5000 }),
            execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repositoryPath, timeout: 5000 }),
            execFileAsync('git', ['status', '--porcelain', '--', '.pigeon'], { cwd: repositoryPath, timeout: 5000 })
        ]);
        return { isRepository: true, root: root.trim(), branch: branch.trim(), commit: commit.trim(), changedFiles: status.split(/\r?\n/).filter(Boolean) };
    } catch { return { isRepository: false, branch: '', commit: '', changedFiles: [] }; }
}

async function managedGitPaths(connection) {
    const local = await readLocalCollection(connection);
    return local.manifest.files.concat(['manifest.json']).map((file) => path.posix.join(connection.relativeCollectionPath.replace(/\\/g, '/'), file));
}

async function requireGitConnection(req, collectionId) {
    const collection = await editableCollection(req, collectionId);
    if (!collection) throw new Error('Collection not found or you do not have edit access');
    const connection = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id });
    if (!connection) throw new Error('Connect a repository before using Git actions');
    const git = await gitStatus(connection.repositoryPath);
    if (!git.isRepository) throw new Error('The connected folder is not a Git repository');
    return { collection, connection, git };
}

router.get('/collections/:collectionId/status', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await editableCollection(req, req.params.collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const connection = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id }).lean();
        if (!connection) return res.json({ connected: false });
        const repositoryPath = await resolveRepository(connection.repositoryPath);
        res.json({ connected: true, connection, git: await gitStatus(repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to read repository status' }); }
});

router.post('/connections', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, repositoryPath, relativeCollectionPath, includeWorkflows = true, includeEnvironmentTemplates = true } = req.body || {};
        const collection = await editableCollection(req, collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const repository = await resolveRepository(repositoryPath);
        const relative = safeRelative(relativeCollectionPath || `.pigeon/collections/${String(collection._id)}`);
        const connection = await GitCollectionConnection.findOneAndUpdate(
            { userId: userId(req), collectionId: collection._id },
            { $set: { workspaceId: collection.workspaceId || null, repositoryPath: repository, relativeCollectionPath: relative, settings: { includeWorkflows: Boolean(includeWorkflows), includeEnvironmentTemplates: Boolean(includeEnvironmentTemplates) } } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ connection, git: await gitStatus(repository) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to connect repository' }); }
});

router.post('/export', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId } = req.body || {};
        const collection = await editableCollection(req, collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const existing = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id });
        const result = await exportCollection({ collection, repositoryPath: req.body.repositoryPath || existing?.repositoryPath, relativeCollectionPath: req.body.relativeCollectionPath || existing?.relativeCollectionPath });
        const connection = await GitCollectionConnection.findOneAndUpdate(
            { userId: userId(req), collectionId: collection._id },
            { $set: { workspaceId: collection.workspaceId || null, repositoryPath: result.repositoryPath, relativeCollectionPath: result.relativeCollectionPath, 'lastSync.databaseHash': result.databaseHash, 'lastSync.filesystemHash': result.filesystemHash, 'lastSync.direction': 'export', 'lastSync.at': new Date() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json({ connection, ...result, git: await gitStatus(result.repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Export failed' }); }
});

async function connectionPaths(req, collectionId, body) {
    const existing = collectionId ? await GitCollectionConnection.findOne({ userId: userId(req), collectionId }) : null;
    return {
        repositoryPath: body.repositoryPath || existing?.repositoryPath,
        relativeCollectionPath: body.relativeCollectionPath || existing?.relativeCollectionPath
    };
}

function previewFor(collection, local) {
    const database = collection ? buildExport(collection) : null;
    const requests = collection ? diffRequests(collection.requests || [], local.requests) : { additions: local.requests.map((request) => ({ id: request.pigeonId || null, name: request.name, local: request })), modifications: [], deletions: [], unchanged: [] };
    return {
        expectedFilesystemHash: local.filesystemHash,
        databaseHash: database?.databaseHash || '', filesystemHash: local.filesystemHash,
        summary: { additions: requests.additions.length, modifications: requests.modifications.length, deletions: requests.deletions.length, unchanged: requests.unchanged.length },
        requests
    };
}

router.post('/import/preview', ensureAuthenticated, async (req, res) => {
    try {
        const collection = req.body?.collectionId ? await editableCollection(req, req.body.collectionId) : null;
        if (req.body?.collectionId && !collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const local = await readLocalCollection(await connectionPaths(req, collection?._id, req.body || {}));
        res.json({ mode: collection ? 'existing' : 'new', local: { name: local.collection.name, requestCount: local.requests.length, relativeCollectionPath: local.relativeCollectionPath }, ...previewFor(collection, local) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to preview local collection' }); }
});

router.post('/import/apply', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, mode = 'merge', expectedFilesystemHash } = req.body || {};
        let collection = collectionId ? await editableCollection(req, collectionId) : null;
        if (collectionId && !collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const paths = await connectionPaths(req, collection?._id, req.body || {});
        const local = await readLocalCollection(paths);
        if (!expectedFilesystemHash || expectedFilesystemHash !== local.filesystemHash) return res.status(409).json({ message: 'Local files changed after preview. Preview again before applying.', currentFilesystemHash: local.filesystemHash });
        const creating = !collection || mode === 'create';
        if (creating) {
            collection = new Collection({ name: local.collection.name, description: local.collection.description || '', workspaceId: req.body.workspaceId || null, userId: userId(req), owner: userId(req) });
        }
        applyLocalToCollection(collection, local, mode === 'replace' ? 'replace' : 'merge');
        await collection.save();
        const result = await exportCollection({ collection, repositoryPath: paths.repositoryPath, relativeCollectionPath: paths.relativeCollectionPath });
        const connection = await GitCollectionConnection.findOneAndUpdate(
            { userId: userId(req), collectionId: collection._id },
            { $set: { workspaceId: collection.workspaceId || null, repositoryPath: result.repositoryPath, relativeCollectionPath: result.relativeCollectionPath, 'lastSync.databaseHash': result.databaseHash, 'lastSync.filesystemHash': result.filesystemHash, 'lastSync.direction': 'import', 'lastSync.at': new Date() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json({ collection, connection, summary: result.summary });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to import local collection' }); }
});

router.post('/sync/preview', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await editableCollection(req, req.body?.collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const connection = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id });
        if (!connection) return res.status(400).json({ message: 'Connect a repository before syncing' });
        const local = await readLocalCollection(connection);
        const databaseHash = buildExport(collection).databaseHash;
        const dbChanged = Boolean(connection.lastSync?.databaseHash && connection.lastSync.databaseHash !== databaseHash);
        const localChanged = Boolean(connection.lastSync?.filesystemHash && connection.lastSync.filesystemHash !== local.filesystemHash);
        const state = !connection.lastSync?.at ? 'not-synced' : dbChanged && localChanged ? 'conflict' : dbChanged ? 'pigeon-changes' : localChanged ? 'local-changes' : 'in-sync';
        res.json({ state, databaseHash, filesystemHash: local.filesystemHash, expectedFilesystemHash: local.filesystemHash, ...previewFor(collection, local) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to preview sync' }); }
});

router.post('/sync/apply', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await editableCollection(req, req.body?.collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const connection = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id });
        if (!connection) return res.status(400).json({ message: 'Connect a repository before syncing' });
        const direction = req.body?.direction;
        if (!['export', 'import'].includes(direction)) return res.status(400).json({ message: 'Choose export or import for sync' });
        if (direction === 'export') {
            const result = await exportCollection({ collection, repositoryPath: connection.repositoryPath, relativeCollectionPath: connection.relativeCollectionPath });
            await GitCollectionConnection.updateOne({ _id: connection._id }, { $set: { 'lastSync.databaseHash': result.databaseHash, 'lastSync.filesystemHash': result.filesystemHash, 'lastSync.direction': 'sync', 'lastSync.at': new Date() } });
            return res.json({ direction, ...result });
        }
        const local = await readLocalCollection(connection);
        if (req.body.expectedFilesystemHash !== local.filesystemHash) return res.status(409).json({ message: 'Local files changed after preview. Preview again before applying.' });
        const pigeonRequests = collection.requests.map(sanitizeRequestForPersistence);
        applyLocalToCollection(collection, local, req.body.mode === 'replace' ? 'replace' : 'merge');
        applyResolutions(collection, local, req.body.resolutions, pigeonRequests);
        await collection.save();
        const result = await exportCollection({ collection, repositoryPath: connection.repositoryPath, relativeCollectionPath: connection.relativeCollectionPath });
        await GitCollectionConnection.updateOne({ _id: connection._id }, { $set: { 'lastSync.databaseHash': result.databaseHash, 'lastSync.filesystemHash': result.filesystemHash, 'lastSync.direction': 'sync', 'lastSync.at': new Date() } });
        return res.json({ direction, collection, ...result });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to apply sync' }); }
});

router.post('/repositories/discover', ensureAuthenticated, async (req, res) => {
    try {
        const repositoryPath = await resolveRepository(req.body?.repositoryPath);
        const root = path.join(repositoryPath, '.pigeon', 'collections');
        const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
        const collections = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            try {
                const local = await readLocalCollection({ repositoryPath, relativeCollectionPath: path.posix.join('.pigeon', 'collections', entry.name) });
                collections.push({ name: local.collection.name, relativeCollectionPath: local.relativeCollectionPath, requestCount: local.requests.length, formatVersion: local.manifest.formatVersion });
            } catch { /* Ignore non-Pigeon folders. */ }
        }
        res.json({ repositoryPath, collections, git: await gitStatus(repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to discover local collections' }); }
});

router.post('/git/init', ensureAuthenticated, async (req, res) => {
    try {
        if (req.body?.confirmed !== true) return res.status(400).json({ message: 'Confirm repository initialization before continuing' });
        const collection = await editableCollection(req, req.body?.collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have edit access' });
        const connection = await GitCollectionConnection.findOne({ userId: userId(req), collectionId: collection._id });
        if (!connection) return res.status(400).json({ message: 'Connect a repository before initializing Git' });
        await execFileAsync('git', ['init'], { cwd: connection.repositoryPath, timeout: 10000 });
        res.json({ git: await gitStatus(connection.repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to initialize repository' }); }
});

router.post('/git/stage', ensureAuthenticated, async (req, res) => {
    try {
        if (req.body?.confirmed !== true) return res.status(400).json({ message: 'Confirm staging Pigeon-managed files before continuing' });
        const { connection } = await requireGitConnection(req, req.body?.collectionId);
        const files = await managedGitPaths(connection);
        await execFileAsync('git', ['add', '--', ...files], { cwd: connection.repositoryPath, timeout: 10000 });
        res.json({ stagedFiles: files, git: await gitStatus(connection.repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to stage Pigeon files' }); }
});

router.post('/git/commit', ensureAuthenticated, async (req, res) => {
    try {
        if (req.body?.confirmed !== true) return res.status(400).json({ message: 'Confirm committing Pigeon-managed files before continuing' });
        const { connection } = await requireGitConnection(req, req.body?.collectionId);
        const files = await managedGitPaths(connection);
        const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only', '--', ...files], { cwd: connection.repositoryPath, timeout: 10000 });
        if (!stdout.trim()) return res.status(400).json({ message: 'No staged Pigeon-managed changes to commit' });
        const message = String(req.body?.message || 'Update Pigeon collection').trim().slice(0, 200);
        await execFileAsync('git', ['commit', '-m', message, '--only', '--', ...files], { cwd: connection.repositoryPath, timeout: 20000 });
        res.json({ git: await gitStatus(connection.repositoryPath) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to commit Pigeon files' }); }
});

module.exports = router;
