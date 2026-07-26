// routes/asyncApiEntities.js
// Granular per-entity CRUD for AsyncAPI documents: add/edit/delete a single
// channel / message / operation without resending the whole arrays. Uses
// atomic MongoDB updateOne (not full-document .save()) — mirrors the
// lastRun updateOne pattern in routes/asyncapi.js / routes/asyncApiScenarios.js
// and avoids legacy embedded-ID full-document validation races.
//
// Mounted from routes/asyncapi.js at the root: declares /:id/channels|messages|
// operations paths itself. Reuses the access-control helpers exported by
// routes/asyncapi.js (toObjectId, userIds, canAccessWorkspace,
// loadAccessibleDocument) — same trust boundary as the parent router.
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const AsyncApiDocument = require('../models/AsyncApiDocument');

const { toObjectId, loadAccessibleDocument } = require('./asyncapi').helpers;

// ----------------------------------------------------------------- helpers

function nameInUse(arr, name) {
    return Array.isArray(arr) && arr.some((x) => x && x.name === name);
}

function pick(body, keys) {
    const out = {};
    for (const k of keys) {
        if (body[k] !== undefined) out[k] = body[k];
    }
    return out;
}

function sanitizeChannel(body = {}) {
    const name = String(body.name || '').trim();
    const out = {
        name,
        address: String(body.address || '').trim(),
        description: String(body.description || ''),
        bindings: (body.bindings && typeof body.bindings === 'object' && !Array.isArray(body.bindings)) ? body.bindings : {}
    };
    return { name, out };
}

function sanitizeMessage(body = {}) {
    const name = String(body.name || '').trim();
    const out = {
        name,
        title: String(body.title || ''),
        description: String(body.description || ''),
        contentType: String(body.contentType || 'application/json'),
        payloadSchema: (body.payloadSchema && typeof body.payloadSchema === 'object' && !Array.isArray(body.payloadSchema)) ? body.payloadSchema : {},
        payloadExample: String(body.payloadExample || ''),
        headersSchema: (body.headersSchema && typeof body.headersSchema === 'object' && !Array.isArray(body.headersSchema)) ? body.headersSchema : {},
        headersExample: String(body.headersExample || '')
    };
    return { name, out };
}

function sanitizeOperation(body = {}) {
    const channelName = String(body.channelName || '').trim();
    const actionRaw = String(body.action || '').trim();
    const action = ['publish', 'subscribe'].includes(actionRaw) ? actionRaw : 'publish';
    return {
        channelName,
        action,
        out: {
            channelName,
            action,
            messageName: String(body.messageName || ''),
            summary: String(body.summary || '')
        }
    };
}

function parseIndex(raw, len) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= len) return null;
    return n;
}

// ----------------------------------------------------------------- channels

router.post('/:id/channels', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const { name, out } = sanitizeChannel(req.body);
        if (!name) return res.status(400).json({ message: 'Channel name is required' });
        if (nameInUse(doc.channels, name)) return res.status(400).json({ message: `A channel named \`${name}\` already exists` });
        const r = await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $push: { channels: out } }
        );
        if (r.modifiedCount === 0) return res.status(500).json({ message: 'Channel was not added' });
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.status(201).json({ channel: (updated.channels || []).find((c) => c.name === name) || out, document: updated });
    } catch (err) {
        console.error('Error adding AsyncAPI channel:', err);
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id/channels/:name', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const name = String(req.params.name);
        const exists = (doc.channels || []).some((c) => c.name === name);
        if (!exists) return res.status(404).json({ message: 'Channel not found' });
        const set = {};
        if (req.body.address !== undefined) set['channels.$[ch].address'] = String(req.body.address);
        if (req.body.description !== undefined) set['channels.$[ch].description'] = String(req.body.description);
        if (req.body.bindings !== undefined) {
            set['channels.$[ch].bindings'] = (req.body.bindings && typeof req.body.bindings === 'object' && !Array.isArray(req.body.bindings)) ? req.body.bindings : {};
        }
        if (Object.keys(set).length === 0) return res.json(await AsyncApiDocument.findById(doc._id).lean());
        const r = await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $set: set },
            { arrayFilters: [{ 'ch.name': name }] }
        );
        if (r.modifiedCount === 0) return res.status(404).json({ message: 'Channel not found' });
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.json({ channel: (updated.channels || []).find((c) => c.name === name), document: updated });
    } catch (err) {
        console.error('Error updating AsyncAPI channel:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/channels/:name', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const name = String(req.params.name);
        const exists = (doc.channels || []).some((c) => c.name === name);
        if (!exists) return res.status(404).json({ message: 'Channel not found' });
        await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $pull: { channels: { name } } }
        );
        res.json({ message: 'Channel deleted' });
    } catch (err) {
        console.error('Error deleting AsyncAPI channel:', err);
        res.status(400).json({ message: err.message });
    }
});

// ----------------------------------------------------------------- messages

router.post('/:id/messages', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const { name, out } = sanitizeMessage(req.body);
        if (!name) return res.status(400).json({ message: 'Message name is required' });
        if (nameInUse(doc.messages, name)) return res.status(400).json({ message: `A message named \`${name}\` already exists` });
        const r = await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $push: { messages: out } }
        );
        if (r.modifiedCount === 0) return res.status(500).json({ message: 'Message was not added' });
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.status(201).json({ message: (updated.messages || []).find((m) => m.name === name) || out, document: updated });
    } catch (err) {
        console.error('Error adding AsyncAPI message:', err);
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id/messages/:name', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const name = String(req.params.name);
        const exists = (doc.messages || []).some((m) => m.name === name);
        if (!exists) return res.status(404).json({ message: 'Message not found' });
        const set = {};
        const b = req.body || {};
        if (b.title !== undefined) set['messages.$[m].title'] = String(b.title);
        if (b.description !== undefined) set['messages.$[m].description'] = String(b.description);
        if (b.contentType !== undefined) set['messages.$[m].contentType'] = String(b.contentType);
        if (b.payloadSchema !== undefined) set['messages.$[m].payloadSchema'] = (b.payloadSchema && typeof b.payloadSchema === 'object' && !Array.isArray(b.payloadSchema)) ? b.payloadSchema : {};
        if (b.payloadExample !== undefined) set['messages.$[m].payloadExample'] = String(b.payloadExample);
        if (b.headersSchema !== undefined) set['messages.$[m].headersSchema'] = (b.headersSchema && typeof b.headersSchema === 'object' && !Array.isArray(b.headersSchema)) ? b.headersSchema : {};
        if (b.headersExample !== undefined) set['messages.$[m].headersExample'] = String(b.headersExample);
        if (Object.keys(set).length === 0) return res.json(await AsyncApiDocument.findById(doc._id).lean());
        const r = await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $set: set },
            { arrayFilters: [{ 'm.name': name }] }
        );
        if (r.modifiedCount === 0) return res.status(404).json({ message: 'Message not found' });
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.json({ message: (updated.messages || []).find((m) => m.name === name), document: updated });
    } catch (err) {
        console.error('Error updating AsyncAPI message:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/messages/:name', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const name = String(req.params.name);
        const exists = (doc.messages || []).some((m) => m.name === name);
        if (!exists) return res.status(404).json({ message: 'Message not found' });
        await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $pull: { messages: { name } } }
        );
        res.json({ message: 'Message deleted' });
    } catch (err) {
        console.error('Error deleting AsyncAPI message:', err);
        res.status(400).json({ message: err.message });
    }
});

// ---------------------------------------------------------------- operations
// Operations have no unique field — addressed by array index. Splice + $set the
// whole operations array in one targeted updateOne (avoids arrayFilters, which
// need a match condition not an index; also avoids the two-step unset/pull).

router.post('/:id/operations', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const { channelName, out } = sanitizeOperation(req.body);
        if (!channelName) return res.status(400).json({ message: 'channelName is required' });
        const r = await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $push: { operations: out } }
        );
        if (r.modifiedCount === 0) return res.status(500).json({ message: 'Operation was not added' });
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.status(201).json({ operation: (updated.operations || []).slice(-1)[0] || out, document: updated });
    } catch (err) {
        console.error('Error adding AsyncAPI operation:', err);
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id/operations/:index', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const ops = Array.isArray(doc.operations) ? doc.operations : [];
        const index = parseIndex(req.params.index, ops.length);
        if (index === null) return res.status(404).json({ message: 'Operation index out of range' });
        const next = ops.map((o) => (o && o.toObject ? o.toObject() : { ...o }));
        const cur = { ...next[index] };
        const b = req.body || {};
        if (b.channelName !== undefined) cur.channelName = String(b.channelName);
        if (b.action !== undefined && ['publish', 'subscribe'].includes(b.action)) cur.action = b.action;
        if (b.messageName !== undefined) cur.messageName = String(b.messageName);
        if (b.summary !== undefined) cur.summary = String(b.summary);
        next[index] = cur;
        await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $set: { operations: next } }
        );
        const updated = await AsyncApiDocument.findById(doc._id).lean();
        res.json({ operation: (updated.operations || [])[index], document: updated });
    } catch (err) {
        console.error('Error updating AsyncAPI operation:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/operations/:index', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const ops = Array.isArray(doc.operations) ? doc.operations : [];
        const index = parseIndex(req.params.index, ops.length);
        if (index === null) return res.status(404).json({ message: 'Operation index out of range' });
        const next = ops.map((o) => (o && o.toObject ? o.toObject() : { ...o }));
        next.splice(index, 1);
        await AsyncApiDocument.updateOne(
            { _id: doc._id },
            { $set: { operations: next } }
        );
        res.json({ message: 'Operation deleted' });
    } catch (err) {
        console.error('Error deleting AsyncAPI operation:', err);
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;