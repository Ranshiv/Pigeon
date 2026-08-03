import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OperationsInvestigation from './OperationsInvestigation';

const investigation = {
    generatedAt: '2026-08-03T12:00:00.000Z',
    target: { type: 'incident', id: 'incident-1', label: 'Checkout outage' },
    window: { start: '2026-08-03T11:00:00.000Z', end: '2026-08-03T12:00:00.000Z' },
    summary: 'Checkout is degraded.',
    impact: { status: 'open', affectedServices: [{ name: 'Checkout' }], alertCount: 2, failedCheckCount: 3, traceErrorCount: 1, anomalyCount: 1 },
    rootCauses: [{ title: 'Upstream service failure', confidence: 'high', rationale: 'Two source families agree.', evidenceIds: ['alert:1'] }],
    steps: [{ order: 1, action: 'Inspect the first failed trace.', reason: 'Find the earliest error path.' }],
    evidence: [{ id: 'alert:1', family: 'alert', status: 'error', relation: 'confirmed', summary: 'HTTP 503', detail: 'Checkout failed', confidenceReason: 'Stored incident relationship.' }],
    drafts: { internal: 'Internal responder update.', public: 'We are investigating checkout errors.' },
    warnings: []
};

test('renders the structured briefing and hands off a draft without publishing it', () => {
    const onInsertDraft = jest.fn();
    render(<OperationsInvestigation investigation={investigation} onInsertDraft={onInsertDraft} />);
    expect(screen.getByText('Checkout is degraded.')).toBeInTheDocument();
    expect(screen.getByText('Upstream service failure')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /insert into incident/i })[1]);
    expect(onInsertDraft).toHaveBeenCalledWith('We are investigating checkout errors.', 'public');
});
