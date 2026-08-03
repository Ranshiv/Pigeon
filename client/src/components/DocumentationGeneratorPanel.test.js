import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentationGeneratorPanel from './DocumentationGeneratorPanel';

jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);
jest.mock('remark-gfm', () => () => null);

const jsonResponse = (body, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

describe('DocumentationGeneratorPanel', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  test('generates a private draft and exposes section-level review controls', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => jsonResponse({ runId: 'run-1', status: 'queued', progress: 0 }, true, 202))
      .mockImplementationOnce(() => jsonResponse({
        _id: 'run-1', status: 'completed', progress: 100, warnings: [],
        draft: {
          coverage: { selected: 1, total: 1, missingExamples: 0, missingErrors: 0 },
          sections: [{ id: 'overview', title: 'Overview', markdown: '# Payments API' }]
        }
      }));

    render(<DocumentationGeneratorPanel collectionId="collection-1" collection={{ requests: [{ _id: 'request-1', name: 'List payments', method: 'GET', url: '/payments' }] }} documentation={{ revision: 3 }} onDocumentationChange={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /generate from collection/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/collections/collection-1/documentation/generations', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText(/Payments API/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /documentation generation progress/i })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Draft ready for review.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: /overview/i }).at(-1)).toBeChecked();
    expect(screen.getByRole('button', { name: /apply selected sections/i })).toBeEnabled();
  });
});
