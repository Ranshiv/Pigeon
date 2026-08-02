const { parseModelResult, normalizeActionProposal, hasActionIntent, resolveActionIntentPrompt, appNavigationAnswer, mergeDocumentationContent, proposalHash, redactText } = require('../services/CopilotService');

const CONTEXT = [{ type: 'collection', id: 'collection-1', label: 'Payments', text: '{}' }];
const REQUEST_CONTEXT = [{
    type: 'collection',
    id: 'collection-1',
    label: 'Payments',
    text: JSON.stringify({ requests: [{ id: 'request-health', name: 'Health Check' }] })
}];
const MCP_CONTEXT = [{
    type: 'collection',
    id: 'collection-1',
    label: 'Payments',
    text: JSON.stringify({ mcpTools: [{ name: 'health_check', description: 'GET /health', params: ['verbose'], acceptsBody: false }] })
}];
const LEGACY_REQUEST_CONTEXT = [{
    type: 'collection',
    id: 'collection-1',
    label: 'Payments',
    text: JSON.stringify({ requests: [{ id: '', name: 'Health Check' }] })
}];

describe('Copilot service safety boundaries', () => {
    test('keeps only citations from selected context and registered actions', () => {
        const result = parseModelResult(JSON.stringify({
            answer: 'Use the payment request.',
            citations: [{ type: 'collection', id: 'collection-1' }, { type: 'collection', id: 'other' }],
            actions: [
                { kind: 'update_documentation', payload: { collectionId: 'collection-1', content: '# Payments' } },
                { kind: 'arbitrary_http', payload: { url: 'https://example.invalid' } }
            ]
        }), CONTEXT);
        expect(result.citations).toEqual([{ type: 'collection', id: 'collection-1', label: 'Payments' }]);
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].kind).toBe('update_documentation');
    });

    test('redacts common inline credentials before persistence or provider calls', () => {
        expect(redactText('authorization: Bearer secret-token password=hunter2')).toContain('[REDACTED]');
        expect(redactText('authorization: Bearer secret-token password=hunter2')).not.toContain('secret-token');
        expect(redactText('authorization: Bearer secret-token password=hunter2')).not.toContain('hunter2');
    });

    test('action hashes are stable for a proposal', () => {
        const payload = { collectionId: 'abc', requestId: 'def' };
        expect(proposalHash('delete_request', payload)).toBe(proposalHash('delete_request', payload));
    });

    test('replaces a placeholder action target with the sole selected collection', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'SELECTED_COLLECTION_ID', content: '## Authentication\nUse a bearer token.' }
        }, CONTEXT, 'Update the documentation with an Authentication section.');
        expect(proposal.payload.collectionId).toBe('collection-1');
        expect(proposal.payload.mode).toBe('merge');
    });

    test('rejects an action target outside multiple selected collections', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'not-selected', content: '## Authentication' }
        }, [...CONTEXT, { type: 'collection', id: 'collection-2', label: 'Orders', text: '{}' }], 'Update the documentation.');
        expect(proposal).toBeNull();
    });

    test('drops documentation actions emitted for a simple question', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'collection-1', content: '## Variables\nDetails.' }
        }, CONTEXT, 'Where is the variables section?');
        expect(proposal).toBeNull();
        expect(hasActionIntent('Where is the variables section?')).toBe(false);
        expect(hasActionIntent('How can I improve the documentation?')).toBe(false);
    });

    test('answers verified application navigation without interpreting collection data', () => {
        expect(appNavigationAnswer('Where is api designer section?'))
            .toBe('Open the collection, then select the API Designer tab in the collection tab bar.');
        expect(appNavigationAnswer('Where is the Variables section?'))
            .toBe('Open the collection, then select the Variables tab in the collection tab bar.');
        expect(appNavigationAnswer('Summarize the variables.')).toBeNull();
    });

    test('allows explicit documentation mutation requests', () => {
        expect(hasActionIntent('Propose exactly one update_documentation action.')).toBe(true);
        expect(hasActionIntent('Can you add an Authentication section?')).toBe(true);
        expect(hasActionIntent('Create new documentation for this collection.')).toBe(true);
        expect(hasActionIntent('I mean update the documentation for this collection.')).toBe(true);
        expect(hasActionIntent('Provide a better version of the current documentation.')).toBe(true);
        expect(hasActionIntent('How do I create documentation?')).toBe(false);
    });

    test('normalizes a create-documentation proposal', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'collection-1', content: '## Overview\n\nCollection documentation.' }
        }, CONTEXT, 'Create new documentation for this collection.');
        expect(proposal?.kind).toBe('update_documentation');
        expect(proposal?.payload.mode).toBe('merge');
    });

    test.each([
        ['create_request', 'Create a request named Health Check.', { collectionId: 'collection-1', request: { name: 'Health Check', method: 'GET', url: 'https://example.com/health' } }],
        ['update_request', 'Rename the request to Public Health Check.', { collectionId: 'collection-1', requestId: 'request-1', request: { name: 'Public Health Check' } }],
        ['delete_request', 'Delete the request named Public Health Check.', { collectionId: 'collection-1', requestId: 'request-1', confirmationName: 'Public Health Check' }],
        ['run_request', 'Run the request named Health Check.', { collectionId: 'collection-1', requestId: 'request-1' }]
    ])('accepts explicit %s proposals', (kind, prompt, payload) => {
        expect(hasActionIntent(prompt)).toBe(true);
        expect(normalizeActionProposal({ kind, payload }, CONTEXT, prompt)?.kind).toBe(kind);
    });

    test('grounds an mcp_call proposal in the context tool catalog', () => {
        const prompt = 'Propose one safe mcp_call action using an available tool.';
        const proposal = normalizeActionProposal({
            kind: 'mcp_call',
            payload: { collectionId: 'collection-1', toolName: 'health_check', arguments: { params: { verbose: 'true' } } }
        }, MCP_CONTEXT, prompt);
        expect(proposal?.payload.toolName).toBe('health_check');
        // Invented tool names, malformed arguments, and undeclared params are
        // the three ways this proposal used to reach a card that always failed.
        expect(normalizeActionProposal({ kind: 'mcp_call', payload: { collectionId: 'collection-1', toolName: 'available tool', arguments: {} } }, MCP_CONTEXT, prompt)).toBeNull();
        expect(normalizeActionProposal({ kind: 'mcp_call', payload: { collectionId: 'collection-1', toolName: 'health_check', arguments: 'none' } }, MCP_CONTEXT, prompt)).toBeNull();
        expect(normalizeActionProposal({ kind: 'mcp_call', payload: { collectionId: 'collection-1', toolName: 'health_check', arguments: { params: { nope: '1' } } } }, MCP_CONTEXT, prompt)).toBeNull();
        expect(normalizeActionProposal({ kind: 'mcp_call', payload: { collectionId: 'collection-1', toolName: 'health_check', arguments: { body: {} } } }, MCP_CONTEXT, prompt)).toBeNull();
        expect(normalizeActionProposal({ kind: 'mcp_call', payload: { collectionId: 'collection-1', toolName: 'health_check', arguments: {} } }, CONTEXT, prompt)).toBeNull();
    });

    test('resolves an update request target by its exact selected-context name', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_request',
            payload: { collectionId: 'collection-1', requestId: 'model-invented-id', request: { name: 'Public Health Check' } }
        }, REQUEST_CONTEXT, 'Find the Health Check request in the selected collection and propose exactly one update_request action that renames it to Public Health Check.');
        expect(proposal?.payload.requestId).toBe('request-health');
        expect(proposal?.payload.targetRequestName).toBe('Health Check');
    });

    test('rejects a request proposal whose target is not in the selected context', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_request',
            payload: { collectionId: 'collection-1', requestId: 'model-invented-id', request: { name: 'Renamed' } }
        }, REQUEST_CONTEXT, 'Rename the request to Renamed.');
        expect(proposal).toBeNull();
    });

    test('allows an exact-name target for a legacy request without an ID', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_request',
            payload: { collectionId: 'collection-1', requestId: 'model-invented-id', request: { name: 'Public Health Check' } }
        }, LEGACY_REQUEST_CONTEXT, 'Find the Health Check request in the selected collection and propose exactly one update_request action that renames it to Public Health Check.');
        expect(proposal?.payload.requestId).toBeUndefined();
        expect(proposal?.payload.targetRequestName).toBe('Health Check');
    });

    test('uses the resolved request name for delete confirmation', () => {
        const proposal = normalizeActionProposal({
            kind: 'delete_request',
            payload: { collectionId: 'collection-1', requestId: 'model-invented-id', confirmationName: 'delete' }
        }, REQUEST_CONTEXT, 'Propose deleting the request named Health Check. Do not execute it.');
        expect(proposal?.payload.requestId).toBe('request-health');
        expect(proposal?.payload.confirmationName).toBe('Health Check');
    });

    test.each([
        'How do I create a request?',
        'Where can I update a request?',
        'Explain how request deletion works.',
        'Which MCP tools are available?'
    ])('keeps informational prompt read-only: %s', (prompt) => {
        expect(hasActionIntent(prompt)).toBe(false);
    });

    test('normalizes alternate documentation payload shapes', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'collection-1', section: { title: 'Authentication', body: 'Use a bearer token.' } }
        }, CONTEXT, 'Add an Authentication section.');
        expect(proposal.payload.content).toBe('## Authentication\n\nUse a bearer token.');
    });

    test.each(['revisedContent', 'documentationContent', 'new_content', 'markdown', 'updatedMarkdown'])(
        'accepts a documentation payload keyed as %s', (key) => {
            const proposal = normalizeActionProposal({
                kind: 'update_documentation',
                payload: { collectionId: 'collection-1', mode: 'merge', [key]: '## Authentication\nUse a bearer token.' }
            }, CONTEXT, 'Update the documentation for this collection');
            expect(proposal).not.toBeNull();
            expect(proposal.payload.content).toContain('Use a bearer token.');
        }
    );

    test('unescapes double-escaped newlines in proposed documentation', () => {
        const proposal = normalizeActionProposal({
            kind: 'update_documentation',
            payload: { collectionId: 'collection-1', revisedContent: '## Authentication\\n\\nUse a bearer token.' }
        }, CONTEXT, 'Update the documentation for this collection');
        expect(proposal.payload.content).toBe('## Authentication\n\nUse a bearer token.');
        expect(proposal.payload.content).not.toContain('\\n');
    });

    test('resolves explicit follow-ups to the latest mutation request and its proposal', () => {
        const history = [
            { role: 'user', content: 'Provide a better version of the current documentation.' },
            { role: 'assistant', content: 'I propose adding an overview, base URL, and error handling sections.' }
        ];
        const resolved = resolveActionIntentPrompt('Do it then', history);
        expect(hasActionIntent(resolved)).toBe(true);
        expect(resolved).toContain('base URL');
        expect(resolveActionIntentPrompt('Ok', history)).toBe('Ok');
    });

    test('parses fenced provider JSON without exposing the JSON envelope', () => {
        const result = parseModelResult('```json\n{"answer":"Ready","citations":[],"actions":[]}\n```', CONTEXT);
        expect(result.answer).toBe('Ready');
        expect(result.actions).toHaveLength(0);
    });

    test('hides truncated provider JSON instead of rendering it as an answer', () => {
        const result = parseModelResult('{"answer":"Ready","actions":[{"kind":"update_documentation"', CONTEXT);
        expect(result.answer).toBe('I could not safely read that response. Please try again.');
        expect(result.answer).not.toContain('"actions"');
    });

    test('merges documentation sections and removes repeated headings', () => {
        const existing = '# API reference\n\n## Authentication\nDescribe required credentials.\n\n## Authentication\nNo authentication is currently required.\n\n## Endpoints\nAdd endpoint details here.\n\n## Endpoints\nOne GET endpoint is available.';
        const proposed = '## Authentication\nUse a bearer token in the Authorization header.\n\n## Variables\nUse `baseUrl` for the API host.';
        const merged = mergeDocumentationContent(existing, proposed);
        expect((merged.match(/^## Authentication$/gm) || [])).toHaveLength(1);
        expect((merged.match(/^## Endpoints$/gm) || [])).toHaveLength(1);
        expect(merged).toContain('Use a bearer token');
        expect(merged).toContain('One GET endpoint is available.');
        expect(merged).not.toContain('Describe required credentials.');
    });

    test('documentation merging is idempotent', () => {
        const existing = '# API reference\n\n## Authentication\nNo authentication is required.';
        const proposed = '## Endpoints\n`GET /health` returns service status.';
        const once = mergeDocumentationContent(existing, proposed);
        expect(mergeDocumentationContent(once, proposed)).toBe(once);
    });
});
