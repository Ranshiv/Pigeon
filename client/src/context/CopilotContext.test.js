import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CopilotContextProvider, useCopilotContext, useCopilotPageContext } from './CopilotContext';

const PageContext = ({ descriptor }) => {
    useCopilotPageContext(descriptor);
    return null;
};

const Probe = () => {
    const value = useCopilotContext();
    return <div>
        <span data-testid="active">{value.activeContext?.label || 'none'}</span>
        <span data-testid="page">{value.activePage.title}</span>
        <span data-testid="workspace">{value.workspaceKey}</span>
        <span data-testid="pins">{value.pinnedSources.map((source) => source.label).join(',')}</span>
        <span data-testid="open">{value.openNonce}</span>
        <button type="button" onClick={() => value.togglePin({ type: 'trace', id: 'trace-1', workspaceId: value.workspaceId, label: 'Checkout trace' })}>pin</button>
    </div>;
};

const Providers = ({ route = '/workspace/home', children }) => <MemoryRouter initialEntries={[route]}>
    <CopilotContextProvider>{children}</CopilotContextProvider>
</MemoryRouter>;

beforeEach(() => localStorage.clear());

test('keeps active context and pins scoped to the current workspace', async () => {
    const { rerender } = render(<Providers>
        <PageContext descriptor={{ type: 'collection', id: 'collection-1', workspaceId: 'workspace-1', label: 'Payments' }} />
        <Probe />
    </Providers>);

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Payments'));
    fireEvent.click(screen.getByText('pin'));
    expect(screen.getByTestId('pins')).toHaveTextContent('Checkout trace');

    rerender(<Providers>
        <PageContext descriptor={{ type: 'workspace', id: 'workspace-2', workspaceId: 'workspace-2', label: 'Platform' }} />
        <Probe />
    </Providers>);

    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('workspace-2'));
    expect(screen.getByTestId('pins')).toHaveTextContent('');
});

test('shows a workspace source pinned from the overview thread', () => {
    const OverviewSourceProbe = () => {
        const value = useCopilotContext();
        return <>
            <span data-testid="overview-pins">{value.pinnedSources.map((source) => source.label).join(',')}</span>
            <button type="button" onClick={() => value.togglePin({ type: 'workspace', id: 'workspace-1', workspaceId: 'workspace-1', label: 'Platform' })}>pin workspace</button>
        </>;
    };

    render(<Providers><OverviewSourceProbe /></Providers>);
    fireEvent.click(screen.getByText('pin workspace'));
    expect(screen.getByTestId('overview-pins')).toHaveTextContent('Platform');
});

test('bridges the existing collection Ask Copilot event through one shared listener', async () => {
    render(<Providers><Probe /></Providers>);
    fireEvent(window, new CustomEvent('pigeon:copilot-context', { detail: { collectionId: 'collection-2', workspaceId: 'workspace-2', label: 'Orders' } }));
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Orders'));
    expect(screen.getByTestId('open')).toHaveTextContent('1');
});

test('names the current page from the route so tabs and id segments never read as a stale resource', () => {
    render(<Providers route="/workspace/collections/6a8485a4b76e9a60c8d88f88?tab=sampleData"><Probe /></Providers>);
    expect(screen.getByTestId('page')).toHaveTextContent('Collections · Sample Data');
});
