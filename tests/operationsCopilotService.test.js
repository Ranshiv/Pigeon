const {
    analysisWindow,
    traceMatchesMonitor,
    deterministicCauses,
    operationsFollowUpAnswer,
    safePublicDraft
} = require('../services/OperationsCopilotService');

describe('Operations Copilot deterministic analysis', () => {
    test('uses 24 hours by default for monitor investigations', () => {
        const result = analysisWindow({ type: 'monitor', record: {} });
        expect(result.timeRange).toBe('24h');
        expect(result.end.getTime() - result.start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    test('caps incident evidence to the 30-day trace retention window', () => {
        const resolvedAt = new Date('2026-08-01T12:00:00.000Z');
        const result = analysisWindow({
            type: 'incident',
            record: { createdAt: new Date('2026-05-01T12:00:00.000Z'), resolvedAt }
        });
        expect(result.retentionLimited).toBe(true);
        expect(result.end.getTime() - result.start.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    test('matches current OpenTelemetry traces by service, route, or host', () => {
        const monitor = { name: 'payments-api', url: 'https://api.example.com/v1/charge', tags: ['payments'] };
        expect(traceMatchesMonitor({ rootServiceName: 'payments-api', services: [], spans: [] }, monitor).matches).toBe(true);
        expect(traceMatchesMonitor({ rootServiceName: 'gateway', services: [], spans: [{ route: '/v1/charge' }] }, monitor).reasons).toContain('route');
        expect(traceMatchesMonitor({ rootServiceName: 'gateway', services: [], spans: [{ url: 'https://api.example.com/other' }] }, monitor).reasons).toContain('host');
    });

    test('requires corroborating signal families for a high-confidence hypothesis', () => {
        const causes = deterministicCauses([
            { id: 'check:1', family: 'check', status: 'error', relation: 'confirmed', summary: 'HTTP 503', detail: 'service unavailable' },
            { id: 'trace:1', family: 'trace', status: 'error', relation: 'inferred', summary: 'HTTP 503', detail: 'bad gateway' }
        ]);
        expect(causes[0]).toMatchObject({ title: 'Upstream service failure', confidence: 'high' });
        expect(causes[0].evidenceIds).toEqual(['check:1', 'trace:1']);
    });

    test('keeps a single inferred signal low confidence', () => {
        const causes = deterministicCauses([
            { id: 'trace:1', family: 'trace', status: 'error', relation: 'inferred', summary: 'database timeout', detail: '' }
        ]);
        expect(causes[0].confidence).toBe('low');
    });

    test('rejects unsafe public drafts and keeps the deterministic fallback', () => {
        const fallback = 'We are investigating an issue affecting checkout.';
        expect(safePublicDraft('Inspect trace ID abc at https://internal.example.test', fallback)).toBe(fallback);
        expect(safePublicDraft('We are investigating elevated errors for checkout.', fallback)).toBe('We are investigating elevated errors for checkout.');
    });

    test('answers remediation follow-ups with the retained investigation steps', () => {
        const result = operationsFollowUpAnswer('How to fix it', {
            target: { type: 'monitor', label: 'Google API Test' },
            impact: { status: 'up' },
            rootCauses: [{ title: 'Dependency or network timeout', confidence: 'low', rationale: 'One timeout signal.', evidenceIds: ['check:1'] }],
            steps: [
                { action: 'Reproduce the latest failed check.', reason: 'Confirm whether the failure is active.' },
                { action: 'Inspect the slowest trace spans.', reason: 'Identify the failing dependency.' }
            ]
        });
        expect(result.answer).toContain('Dependency or network timeout');
        expect(result.answer).toContain('1. **Reproduce the latest failed check.**');
        expect(result.answer).toContain('2. **Inspect the slowest trace spans.**');
        expect(result.answer).toContain('active or historical');
        expect(result.evidenceIds).toEqual(['check:1']);
    });

    test('recovers an incomplete remediation answer when the user replies with question marks', () => {
        const result = operationsFollowUpAnswer('??', {
            target: { type: 'incident', label: 'Checkout outage' },
            rootCauses: [],
            steps: [{ action: 'Validate the current monitor state.', reason: 'Confirm impact.' }]
        }, [{ role: 'assistant', content: 'Fix the issue by following these steps:' }]);
        expect(result.answer).toContain('1. **Validate the current monitor state.**');
    });

    test('advances short follow-ups through the investigation steps instead of repeating the briefing', () => {
        const investigation = {
            target: { type: 'incident', label: 'Checkout outage' },
            steps: [
                { action: 'Confirm the current monitor state.', reason: 'Determine whether the issue is active.' },
                { action: 'Inspect the latest failed check.', reason: 'Capture the concrete failure signal.' }
            ],
            evidence: [{ id: 'check:1', family: 'check', summary: 'The latest check timed out.' }]
        };
        const first = operationsFollowUpAnswer('Then?', investigation, [{ role: 'user', content: 'How to fix it' }]);
        expect(first.answer).toContain('step 2: Inspect the latest failed check.');
        const final = operationsFollowUpAnswer('After that?', investigation, [
            { role: 'user', content: 'How to fix it' },
            { role: 'user', content: 'Then?' }
        ]);
        expect(final.answer).toContain('There are no further evidence-backed steps');
    });

    test('answers cause, detail, and bullet follow-ups without truncating model prose', () => {
        const investigation = {
            target: { type: 'monitor', label: 'Google API Test', status: 'up' },
            impact: { status: 'up', failedCheckCount: 16 },
            rootCauses: [{ title: 'Dependency or network timeout', confidence: 'medium', rationale: '16 related signals across one evidence source.', evidenceIds: ['check:1'] }],
            evidence: [{ id: 'check:1', family: 'check', summary: 'HTTP 200 response exceeded the timeout threshold.', detail: 'Response latency ranged from 1015 ms to 5235 ms.' }],
            steps: [{ action: 'Inspect the slowest trace spans.', reason: 'Identify the dependency contributing the latency.' }]
        };
        expect(operationsFollowUpAnswer('What is causing the issue', investigation).answer).toContain('Dependency or network timeout');
        expect(operationsFollowUpAnswer('Detailed explanation please', investigation).answer).toContain('HTTP 200 response exceeded the timeout threshold.');
        const bullets = operationsFollowUpAnswer('In bullet points', investigation).answer;
        expect(bullets).toContain('- **Likely cause:**');
        expect(bullets).toContain('- **Supporting evidence:**');
        expect(bullets).toContain('1. **Inspect the slowest trace spans.**');
    });
});
