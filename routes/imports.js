const path = require('path');
const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const Environment = require('../models/Environment');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const {
    PostmanImportError,
    convertPostmanDocument
} = require('../services/importers/PostmanImporter');

const router = express.Router();
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAX_IMPORT_BYTES },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        if (extension !== '.json') {
            return callback(new PostmanImportError('Only .json Postman exports can be imported.', 'INVALID_FILE_TYPE'));
        }
        return callback(null, true);
    }
});

const userIdOf = (user) => String(user?.id || user?._id || '');

const resolveWorkspace = async (db, requestedWorkspaceId, user) => {
    const userId = userIdOf(user);
    const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;

    if (requestedWorkspaceId) {
        if (!ObjectId.isValid(requestedWorkspaceId)) {
            const error = new PostmanImportError('Invalid workspace ID.', 'INVALID_WORKSPACE');
            error.statusCode = 400;
            throw error;
        }
        const workspace = await db.collection('workspaces').findOne({ _id: new ObjectId(requestedWorkspaceId) });
        if (!workspace) {
            const error = new PostmanImportError('Workspace not found.', 'WORKSPACE_NOT_FOUND');
            error.statusCode = 404;
            throw error;
        }
        const isOwner = String(workspace.owner) === userId;
        const collaborator = (workspace.collaborators || []).find((member) => String(member.userId) === userId);
        const role = isOwner ? 'admin' : collaborator?.role;
        if (!['admin', 'editor'].includes(role)) {
            const error = new PostmanImportError('You need editor access to import into this workspace.', 'WORKSPACE_ACCESS_DENIED');
            error.statusCode = 403;
            throw error;
        }
        return workspace._id;
    }

    const personalWorkspace = await db.collection('workspaces').findOne({
        isPersonal: true,
        $or: [
            { owner: userId },
            ...(userObjectId ? [{ owner: userObjectId }] : [])
        ]
    });
    return personalWorkspace?._id || null;
};

const uniqueEnvironmentName = async (name, userId, workspaceId) => {
    const baseName = String(name || 'Imported Postman Environment').slice(0, 180);
    let candidate = baseName;
    let suffix = 0;
    while (await Environment.exists({ name: candidate, userId, workspaceId: workspaceId || null })) {
        suffix += 1;
        candidate = `${baseName} (Imported${suffix > 1 ? ` ${suffix}` : ''})`.slice(0, 200);
    }
    return candidate;
};

const writeImportActivity = async (db, user, workspaceId, converted, resourceId) => {
    if (!workspaceId) return;
    try {
        await db.collection('workspaceActivity').insertOne({
            workspaceId,
            type: `${converted.kind}_imported`,
            message: `Imported ${converted.kind} '${converted.name}' from Postman`,
            user: {
                userId: userIdOf(user),
                displayName: user.displayName || user.name || 'User',
                email: user.email || ''
            },
            timestamp: new Date(),
            details: {
                resourceId: String(resourceId),
                source: 'postman',
                requestCount: converted.requests?.length || 0,
                variableCount: converted.variables?.length || 0
            }
        });
    } catch (error) {
        console.warn('Non-fatal: failed to record Postman import activity:', error.message);
    }
};

router.post('/postman', ensureAuthenticated, (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (error) return next(error);
        return next();
    });
}, async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ code: 'FILE_REQUIRED', message: 'Choose a Postman collection or environment JSON file.' });
        }

        let document;
        try {
            const source = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
            document = JSON.parse(source);
        } catch {
            return res.status(400).json({ code: 'INVALID_JSON', message: 'The selected file does not contain valid JSON.' });
        }

        const converted = convertPostmanDocument(document);
        const db = getDb();
        const workspaceId = await resolveWorkspace(db, req.body.workspaceId, req.user);
        const userId = userIdOf(req.user);
        const owner = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
        const warnings = [...converted.warnings];

        if (converted.kind === 'collection') {
            const now = new Date();
            const importedRequests = converted.requests.map((request) => ({
                ...request,
                _id: new ObjectId()
            }));
            const collection = {
                name: converted.name,
                description: converted.description,
                workspaceId,
                userId: owner,
                owner,
                variables: converted.variables,
                requests: importedRequests,
                isPublic: false,
                collaborators: [],
                version: '1.0.0',
                branch: 'main',
                stats: {
                    requestCount: converted.requests.length,
                    totalRuns: 0,
                    successRate: 0
                },
                metadata: {
                    ...converted.metadata,
                    importedBy: userId
                },
                createdAt: now,
                updatedAt: now
            };
            const result = await db.collection('collections').insertOne(collection);
            let documentationImported = false;
            if (converted.documentation?.content) {
                try {
                    await db.collection('documentation').insertOne({
                        title: converted.documentation.title,
                        content: converted.documentation.content,
                        collectionId: result.insertedId.toString(),
                        importedFrom: 'postman',
                        settings: {},
                        createdAt: now,
                        updatedAt: now
                    });
                    documentationImported = true;
                } catch (documentationError) {
                    console.warn('Non-fatal: failed to save Postman documentation:', documentationError.message);
                    warnings.push('The collection imported, but its generated Postman documentation could not be saved.');
                }
            }
            await writeImportActivity(db, req.user, workspaceId, converted, result.insertedId);
            return res.status(201).json({
                kind: 'collection',
                message: `Imported ${converted.requests.length} requests from Postman.`,
                resource: {
                    _id: result.insertedId.toString(),
                    name: collection.name,
                    workspaceId: workspaceId?.toString?.() || null,
                    requestCount: converted.requests.length,
                    variableCount: converted.variables.length,
                    documentationImported
                },
                warnings
            });
        }

        const environmentName = await uniqueEnvironmentName(converted.name, owner, workspaceId);
        if (environmentName !== converted.name) {
            warnings.push(`An environment named "${converted.name}" already existed, so this import was saved as "${environmentName}".`);
        }
        const environment = new Environment({
            name: environmentName,
            description: converted.description,
            type: converted.type,
            userId: owner,
            workspaceId,
            variables: converted.variables,
            isActive: false,
            isShared: false,
            metadata: {
                ...converted.metadata,
                importedBy: userId
            }
        });
        await environment.save();
        await writeImportActivity(db, req.user, workspaceId, converted, environment._id);
        return res.status(201).json({
            kind: 'environment',
            message: `Imported ${converted.variables.length} environment variables from Postman.`,
            resource: {
                _id: environment._id.toString(),
                name: environment.name,
                workspaceId: workspaceId?.toString?.() || null,
                variableCount: converted.variables.length
            },
            warnings
        });
    } catch (error) {
        const statusCode = error.statusCode || (error instanceof PostmanImportError ? 400 : 500);
        if (statusCode >= 500) console.error('Postman import failed:', error);
        return res.status(statusCode).json({
            code: error.code || 'POSTMAN_IMPORT_FAILED',
            message: statusCode >= 500 ? 'Postman import failed.' : error.message
        });
    }
});

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? `Postman exports must be smaller than ${MAX_IMPORT_BYTES / (1024 * 1024)} MB.`
            : 'The Postman file upload could not be processed.';
        return res.status(400).json({ code: error.code, message });
    }
    if (error instanceof PostmanImportError) {
        return res.status(400).json({ code: error.code, message: error.message });
    }
    return next(error);
});

module.exports = router;
