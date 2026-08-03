const express = require('express');
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const CopilotConversation = require('../models/CopilotConversation');
const CopilotAction = require('../models/CopilotAction');
const nim = require('../services/CopilotNimClient');
const copilot = require('../services/CopilotService');
const contextual = require('../services/CopilotContextService');
const operations = require('../services/OperationsCopilotService');

const router = express.Router();
const userId = (req) => String(req.user?.id || req.user?._id || '');
const oid = (value) => ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null;
const ownedConversation = (id, req) => CopilotConversation.findOne({ _id: id, owner: oid(userId(req)), deletedAt: null });
const serializeConversation = (conversation) => ({ id: String(conversation._id), workspaceId: conversation.workspaceId ? String(conversation.workspaceId) : null, title: conversation.title, profileId: conversation.profileId, messages: conversation.messages || [], createdAt: conversation.createdAt, updatedAt: conversation.updatedAt });

router.get('/profiles', ensureAuthenticated, (_req, res) => res.json({ profiles: nim.publicProfiles() }));
router.get('/operations/targets', ensureAuthenticated, async (req, res) => {
    try {
        return res.json(await operations.listTargets({ workspaceId: req.query.workspaceId }, req.user));
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to load investigation targets.' });
    }
});
router.post('/operations/investigations', ensureAuthenticated, async (req, res) => {
    try {
        const profile = req.body?.profileId ? nim.getProfile(req.body.profileId) : null;
        if (req.body?.profileId && !profile) return res.status(503).json({ message: 'The selected NVIDIA NIM profile is unavailable.' });
        let conversation = req.body?.conversationId ? await ownedConversation(req.body.conversationId, req) : null;
        if (req.body?.conversationId && !conversation) return res.status(404).json({ message: 'Conversation not found.' });
        const investigation = await operations.generateInvestigation({
            target: req.body?.target,
            timeRange: req.body?.timeRange,
            profile,
            nim
        }, req.user);
        const conversationProfileId = profile?.id || 'deterministic';
        if (conversation?.workspaceId && String(conversation.workspaceId) !== String(investigation.target.workspaceId)) {
            return res.status(409).json({ message: 'This conversation belongs to a different workspace.' });
        }
        if (conversation && conversation.profileId !== conversationProfileId) {
            return res.status(400).json({ message: 'A conversation cannot switch Copilot profiles.' });
        }
        if (!conversation) conversation = new CopilotConversation({
            owner: oid(userId(req)),
            workspaceId: oid(investigation.target.workspaceId),
            profileId: conversationProfileId,
            title: `${investigation.target.type === 'incident' ? 'Incident' : 'Monitor'} · ${investigation.target.label}`.slice(0, 80)
        });
        const targetCitation = {
            type: investigation.target.type,
            id: investigation.target.id,
            label: investigation.target.label,
            deepLink: investigation.target.deepLink
        };
        conversation.messages.push({
            role: 'user',
            content: `Investigate ${investigation.target.type} “${investigation.target.label}” using current monitoring evidence.`,
            citations: [targetCitation],
            contextSnapshot: [{
                type: investigation.target.type,
                id: investigation.target.id,
                workspaceId: investigation.target.workspaceId,
                capturedAt: investigation.generatedAt,
                evidence: investigation.evidence
            }]
        });
        conversation.messages.push({
            role: 'assistant',
            content: operations.investigationMarkdown(investigation),
            citations: [targetCitation, ...investigation.evidence.slice(0, 12).map((item) => ({
                type: item.sourceType,
                id: item.sourceId,
                label: item.label,
                deepLink: item.deepLink,
                evidenceId: item.id,
                relation: item.relation,
                confidenceReason: item.confidenceReason
            }))],
            findings: investigation.evidence.filter((item) => ['error', 'warning'].includes(item.status)).slice(0, 24).map((item) => ({
                ...item,
                kind: item.family,
                sourceType: item.sourceType,
                sourceId: item.sourceId,
                sourceLabel: item.label
            })),
            artifact: { type: 'operations_investigation', data: investigation }
        });
        await conversation.save();
        return res.json({ conversation: serializeConversation(conversation), investigation });
    } catch (error) {
        return res.status(error.status || 400).json({ message: error.message || 'Unable to generate an investigation.' });
    }
});
router.get('/context/collections', ensureAuthenticated, async (req, res) => {
    try {
        const { getDb } = require('../config/db');
        const values = [userId(req), oid(userId(req))].filter(Boolean);
        const collections = await getDb().collection('collections').find({ $or: [{ owner: { $in: values } }, { userId: { $in: values } }, { collaborators: { $elemMatch: { userId: { $in: values }, role: { $in: ['viewer', 'editor', 'admin'] } } } }] }).project({ name: 1, workspaceId: 1 }).limit(100).toArray();
        res.json({ collections: collections.map((item) => ({ id: String(item._id), name: item.name, workspaceId: item.workspaceId ? String(item.workspaceId) : null })) });
    } catch (error) { res.status(500).json({ message: 'Unable to load Copilot context sources.' }); }
});
router.get('/context/sources', ensureAuthenticated, async (req, res) => {
    try {
        const sources = await contextual.listSources({
            workspaceId: req.query.workspaceId,
            query: req.query.q || '',
            types: req.query.types || ''
        }, req.user);
        res.json({ sources });
    } catch (error) { res.status(500).json({ message: 'Unable to load Copilot context sources.' }); }
});
router.get('/conversations', ensureAuthenticated, async (req, res) => {
    const query = { owner: oid(userId(req)), deletedAt: null };
    if (req.query.workspaceId === 'overview') query.workspaceId = null;
    else if (req.query.workspaceId) {
        const workspaceId = oid(req.query.workspaceId);
        if (!workspaceId) return res.status(400).json({ message: 'Invalid workspace ID.' });
        query.workspaceId = workspaceId;
    }
    const conversations = await CopilotConversation.find(query).sort({ updatedAt: -1 }).limit(50);
    res.json({ conversations: conversations.map(serializeConversation) });
});
router.get('/conversations/:id', ensureAuthenticated, async (req, res) => {
    const conversation = await ownedConversation(req.params.id, req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    return res.json(serializeConversation(conversation));
});
router.delete('/conversations/:id', ensureAuthenticated, async (req, res) => {
    const conversation = await ownedConversation(req.params.id, req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    conversation.deletedAt = new Date(); await conversation.save(); return res.status(204).end();
});
router.post('/messages', ensureAuthenticated, async (req, res) => {
    try {
        const prompt = copilot.redactText(req.body?.prompt || '').trim();
        if (!prompt) return res.status(400).json({ message: 'Enter a Copilot message.' });
        const profile = nim.getProfile(req.body?.profileId);
        if (!profile) return res.status(503).json({ message: 'The selected NVIDIA NIM profile is unavailable.' });
        let conversation = req.body?.conversationId ? await ownedConversation(req.body.conversationId, req) : null;
        const intentPrompt = copilot.resolveActionIntentPrompt(prompt, conversation?.messages || []);
        const contextResult = await contextual.resolveContext({
            activeContext: req.body?.activeContext,
            pinnedSources: req.body?.pinnedSources,
            sources: req.body?.sources
        }, req.user, intentPrompt, (source) => copilot.buildContext([source], req.user, intentPrompt));
        let context = contextResult.items;
        const retainedArtifact = [...(conversation?.messages || [])].reverse().find((message) => message.artifact?.type === 'operations_investigation')?.artifact?.data;
        if (retainedArtifact?.target?.id && String(retainedArtifact.target.id) === String(req.body?.activeContext?.id || '')) {
            const retainedEvidence = (retainedArtifact.evidence || []).map((item) => ({
                id: item.id,
                kind: item.family,
                status: item.status,
                summary: item.summary,
                detail: item.detail,
                relation: item.relation,
                confidenceReason: item.confidenceReason,
                deepLink: item.deepLink
            }));
            const retainedItem = {
                type: retainedArtifact.target.type,
                id: String(retainedArtifact.target.id),
                label: retainedArtifact.target.label,
                workspaceId: retainedArtifact.target.workspaceId,
                origin: 'active',
                deepLink: retainedArtifact.target.deepLink,
                capturedAt: retainedArtifact.generatedAt,
                evidence: retainedEvidence,
                text: copilot.redactText(JSON.stringify({
                    resource: {
                        generatedAt: retainedArtifact.generatedAt,
                        window: retainedArtifact.window,
                        impact: retainedArtifact.impact,
                        summary: retainedArtifact.summary,
                        rootCauses: retainedArtifact.rootCauses,
                        steps: retainedArtifact.steps
                    },
                    evidence: retainedEvidence
                }), 20000)
            };
            context = [...context.filter((item) => !(item.type === retainedItem.type && String(item.id) === retainedItem.id)), retainedItem];
            contextResult.findings = retainedEvidence.filter((item) => ['error', 'warning'].includes(item.status)).slice(0, 24).map((item) => ({
                ...item,
                sourceType: retainedItem.type,
                sourceId: retainedItem.id,
                sourceLabel: retainedItem.label
            }));
            contextResult.snapshot = [{ ...retainedItem, content: retainedItem.text }];
            contextResult.workspaceId = retainedItem.workspaceId;
        }
        if (conversation?.workspaceId && contextResult.workspaceId && String(conversation.workspaceId) !== String(contextResult.workspaceId)) {
            return res.status(409).json({ message: 'This conversation belongs to a different workspace. Open that workspace thread instead.' });
        }
        if (!conversation) conversation = new CopilotConversation({ owner: oid(userId(req)), workspaceId: contextResult.workspaceId || null, profileId: profile.id, title: prompt.slice(0, 80) });
        if (conversation.profileId !== profile.id) return res.status(400).json({ message: 'A conversation cannot switch NVIDIA profiles.' });
        const operationsFollowUp = retainedArtifact?.target?.id && String(retainedArtifact.target.id) === String(req.body?.activeContext?.id || '')
            ? operations.operationsFollowUpAnswer(prompt, retainedArtifact, conversation.messages || [])
            : null;
        conversation.messages.push({ role: 'user', content: prompt, citations: context.map(({ type, id, label, deepLink }) => ({ type, id, label, deepLink })), contextSnapshot: contextResult.snapshot });
        const actionIntent = copilot.hasActionIntent(intentPrompt);
        const navigationAnswer = copilot.appNavigationAnswer(intentPrompt);
        const operationsCitations = operationsFollowUp ? [
            {
                type: retainedArtifact.target.type,
                id: String(retainedArtifact.target.id),
                label: retainedArtifact.target.label,
                deepLink: retainedArtifact.target.deepLink
            },
            ...(retainedArtifact.evidence || []).filter((item) => operationsFollowUp.evidenceIds.includes(item.id)).map((item) => ({
                type: item.sourceType,
                id: String(item.sourceId || ''),
                label: item.label,
                deepLink: item.deepLink,
                evidenceId: item.id,
                relation: item.relation,
                confidenceReason: item.confidenceReason
            }))
        ] : [];
        let parsedResult = navigationAnswer
            ? { answer: navigationAnswer, citations: [], actions: [] }
            : operationsFollowUp ? { answer: operationsFollowUp.answer, citations: operationsCitations, actions: [] } : null;
        let normalizedActions = [];
        if (!parsedResult) {
            const messages = copilot.modelMessages(conversation.messages, context, intentPrompt, req.body?.activePage);
            for (let attempt = 0; attempt < (actionIntent ? 2 : 1); attempt += 1) {
                const attemptMessages = attempt === 0 ? messages : [
                    ...messages.slice(0, -1),
                    { role: 'system', content: 'The previous response did not contain a valid requested action. Return the explicitly requested action now, using the selected SOURCE ID as collectionId and all required payload fields.' },
                    messages[messages.length - 1]
                ];
                parsedResult = copilot.parseModelResult(await nim.complete(profile, attemptMessages), context);
                normalizedActions = parsedResult.actions.map((proposal) => copilot.normalizeActionProposal(proposal, context, intentPrompt)).filter(Boolean);
                if (!actionIntent || normalizedActions.length) break;
                console.warn('[Copilot] retrying missing or invalid action proposal', { attempt: attempt + 1, kinds: parsedResult.actions.map((proposal) => proposal.kind) });
            }
        }
        if (actionIntent && !normalizedActions.length) {
            console.warn('[Copilot] rejected unsafe action proposal', { kinds: parsedResult.actions.map((proposal) => proposal.kind), payloadKeys: parsedResult.actions.map((proposal) => Object.keys(proposal.payload || {})) });
        }
        const result = {
            ...parsedResult,
            answer: actionIntent && !normalizedActions.length
                ? 'I could not validate the generated action proposal. Please try that request again.'
                : parsedResult.answer,
            actions: normalizedActions
        };
        conversation.messages.push({ role: 'assistant', content: result.answer, citations: result.citations, findings: contextResult.findings });
        await conversation.save();
        const actions = await Promise.all(result.actions.map(async (proposal) => {
            const payload = proposal.payload;
            const action = await CopilotAction.create({ conversationId: conversation._id, owner: oid(userId(req)), workspaceId: conversation.workspaceId, kind: proposal.kind, payload, preview: copilot.actionPreview(proposal.kind, payload), proposalHash: copilot.proposalHash(proposal.kind, payload), expiresAt: copilot.actionExpiresAt() });
            let typedConfirmationLabel = null;
            if (action.kind === 'delete_request') {
                const collection = await copilot.loadCollection(action.payload.collectionId, req.user, 'viewer');
                const request = collection?.requests?.find((item) => String(item._id || item.id || item.requestId || '') === String(action.payload.requestId || ''))
                    || collection?.requests?.find((item) => String(item.name || '').trim() === String(action.payload.targetRequestName || '').trim());
                typedConfirmationLabel = request?.name || null;
            }
            return { id: String(action._id), kind: action.kind, payload: action.payload, proposalHash: action.proposalHash, preview: action.preview, expiresAt: action.expiresAt, typedConfirmationLabel };
        }));
        return res.json({ conversation: serializeConversation(conversation), answer: result.answer, citations: result.citations, actions, findings: contextResult.findings, resolvedContext: contextResult.resolvedContext });
    } catch (error) { return res.status(400).json({ message: error.message || 'Copilot could not complete the request.' }); }
});
router.post('/actions/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const action = await CopilotAction.findOne({ _id: req.params.id, owner: oid(userId(req)), status: 'pending' });
        if (!action) return res.status(404).json({ message: 'Pending Copilot action not found.' });
        if (action.expiresAt < new Date()) { action.status = 'expired'; await action.save(); return res.status(410).json({ message: 'This action proposal expired.' }); }
        if (req.body?.proposalHash !== action.proposalHash) return res.status(409).json({ message: 'The action proposal changed; request a new proposal.' });
        if (action.kind === 'delete_request' && String(req.body?.typedConfirmation || '') !== String(action.payload?.confirmationName || '')) {
            return res.status(400).json({ status: 'pending', code: 'confirmation_required', message: 'Type the exact request name to confirm deletion.' });
        }
        action.status = 'approved'; action.approvedAt = new Date(); await action.save();
        try { action.result = await copilot.executeAction(action, req.user, String(req.body?.typedConfirmation || '')); action.status = 'executed'; action.executedAt = new Date(); }
        catch (error) { action.status = 'failed'; action.error = error.message || 'Action failed.'; }
        await action.save();
        return res.status(action.status === 'executed' ? 200 : 400).json({ id: String(action._id), status: action.status, result: action.result, message: action.error || null, error: action.error || null });
    } catch (error) { return res.status(400).json({ message: error.message || 'Unable to execute Copilot action.' }); }
});
router.post('/actions/:id/reject', ensureAuthenticated, async (req, res) => { const action = await CopilotAction.findOneAndUpdate({ _id: req.params.id, owner: oid(userId(req)), status: 'pending' }, { $set: { status: 'rejected' } }, { new: true }); if (!action) return res.status(404).json({ message: 'Pending Copilot action not found.' }); return res.json({ id: String(action._id), status: action.status }); });

module.exports = router;
