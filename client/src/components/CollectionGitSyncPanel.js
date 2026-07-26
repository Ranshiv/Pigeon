import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiDownload, FiFolder, FiGitBranch, FiRefreshCw, FiX } from 'react-icons/fi';
import './CollectionGitSyncPanel.css';

const emptyForm = { repositoryPath: '', relativeCollectionPath: '', includeWorkflows: true, includeEnvironmentTemplates: true };

const CollectionGitSyncPanel = ({ collectionId, collectionName }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [showConnect, setShowConnect] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [preview, setPreview] = useState(null);
    const [gitAction, setGitAction] = useState('');
    const [commitMessage, setCommitMessage] = useState('Update Pigeon collection');
    const [conflictEditor, setConflictEditor] = useState(false);
    const [resolutions, setResolutions] = useState({});

    const load = useCallback(async () => {
        if (!collectionId) return;
        setLoading(true); setError('');
        try {
            const res = await fetch(`/api/git-collections/collections/${collectionId}/status`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to load Git connection');
            setStatus(data);
            if (data.connection) setForm((current) => ({ ...current, repositoryPath: data.connection.repositoryPath || '', relativeCollectionPath: data.connection.relativeCollectionPath || '' }));
        } catch (requestError) { setError(requestError.message || 'Unable to load Git connection'); }
        finally { setLoading(false); }
    }, [collectionId]);

    useEffect(() => { load(); }, [load]);

    const connect = async (event) => {
        event.preventDefault();
        setBusy(true); setError(''); setNotice('');
        try {
            const res = await fetch('/api/git-collections/connections', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionId, ...form }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to connect repository');
            setStatus({ connected: true, connection: data.connection, git: data.git });
            setShowConnect(false); setNotice('Repository connected. Preview/export is now available.');
        } catch (requestError) { setError(requestError.message || 'Unable to connect repository'); }
        finally { setBusy(false); }
    };

    const exportCollection = async () => {
        setBusy(true); setError(''); setNotice('');
        try {
            const res = await fetch('/api/git-collections/export', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionId }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to export collection');
            setStatus({ connected: true, connection: data.connection, git: data.git });
            const summary = data.summary || {};
            setNotice(`Export complete: ${summary.created?.length || 0} created, ${summary.updated?.length || 0} updated, ${summary.unchanged?.length || 0} unchanged.`);
        } catch (requestError) { setError(requestError.message || 'Unable to export collection'); }
        finally { setBusy(false); }
    };

    const previewSync = async () => {
        setBusy(true); setError(''); setNotice('');
        try {
            const res = await fetch('/api/git-collections/sync/preview', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionId }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to preview synchronization');
            setPreview(data);
        } catch (requestError) { setError(requestError.message || 'Unable to preview synchronization'); }
        finally { setBusy(false); }
    };

    const applySync = async (direction, selectedResolutions = []) => {
        if (!preview) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const res = await fetch('/api/git-collections/sync/apply', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionId, direction, expectedFilesystemHash: preview.expectedFilesystemHash, mode: 'merge', resolutions: selectedResolutions }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Unable to apply synchronization');
            setPreview(null); setConflictEditor(false); setNotice(direction === 'export' ? 'Pigeon changes exported to local files.' : 'Local collection changes imported into Pigeon.');
            await load();
        } catch (requestError) { setError(requestError.message || 'Unable to apply synchronization'); }
        finally { setBusy(false); }
    };

    const openConflictEditor = () => {
        const initial = Object.fromEntries((preview?.requests?.modifications || []).map((item) => [item.id, { choice: 'local', manualText: JSON.stringify(item.local, null, 2) }]));
        setResolutions(initial); setConflictEditor(true);
    };

    const applyConflictResolutions = () => {
        try {
            const selected = Object.entries(resolutions).map(([id, item]) => ({ id, choice: item.choice, ...(item.choice === 'manual' ? { manual: JSON.parse(item.manualText) } : {}) }));
            applySync('import', selected);
        } catch { setError('Manual request JSON must be valid before applying the conflict resolution.'); }
    };

    const runGitAction = async () => {
        if (!gitAction) return;
        setBusy(true); setError('');
        try {
            const body = { collectionId, confirmed: true };
            if (gitAction === 'commit') body.message = commitMessage;
            const res = await fetch(`/api/git-collections/git/${gitAction}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `Unable to ${gitAction}`);
            setGitAction(''); setNotice(gitAction === 'stage' ? 'Pigeon-managed files staged.' : gitAction === 'commit' ? 'Pigeon-managed files committed.' : 'Git repository initialized.');
            await load();
        } catch (requestError) { setError(requestError.message || `Unable to ${gitAction}`); }
        finally { setBusy(false); }
    };

    const git = status?.git;
    return (
        <section className="git-sync-panel">
            <header className="git-sync-head">
                <div><span className="git-sync-eyebrow"><FiGitBranch /> Local-first collection</span><h3>Git Sync</h3><p>Export <strong>{collectionName || 'this collection'}</strong> as redacted, reviewable files. Pigeon only manages files listed in its manifest.</p></div>
                <button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={load} disabled={loading || busy}><FiRefreshCw className={loading ? 'git-sync-spin' : undefined} /> Refresh</button>
            </header>

            {error && <div className="git-sync-message git-sync-message--error" role="alert">{error}</div>}
            {notice && <div className="git-sync-message git-sync-message--success"><FiCheckCircle /> {notice}</div>}

            {loading ? <div className="git-sync-empty">Loading repository status…</div> : !status?.connected ? (
                <div className="git-sync-empty"><FiFolder /><strong>No repository connected</strong><span>Choose an existing local repository to export a Git-friendly `.pigeon` collection directory.</span><button type="button" className="git-sync-btn git-sync-btn--primary" onClick={() => setShowConnect(true)}>Connect repository</button></div>
            ) : (
                <>
                    <div className="git-sync-grid">
                        <article><span>Connection</span><strong>{git?.isRepository ? 'Git repository' : 'Folder only'}</strong></article>
                        <article><span>Branch</span><strong>{git?.branch || 'Not detected'}</strong></article>
                        <article><span>Latest commit</span><strong>{git?.commit || 'No commit'}</strong></article>
                        <article><span>Pigeon file changes</span><strong>{git?.changedFiles?.length || 0}</strong></article>
                    </div>
                    <div className="git-sync-path"><span>Repository</span><code>{status.connection.repositoryPath}</code><span>Collection files</span><code>{status.connection.relativeCollectionPath}</code></div>
                    <div className="git-sync-actions"><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setShowConnect(true)}>Connection settings</button>{git?.isRepository ? <><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setGitAction('stage')}>Stage Pigeon files</button><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setGitAction('commit')}>Commit Pigeon files</button></> : <button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setGitAction('init')}>Initialize Git</button>}<button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={previewSync} disabled={busy}><FiRefreshCw /> Preview sync</button><button type="button" className="git-sync-btn git-sync-btn--primary" onClick={exportCollection} disabled={busy}><FiDownload /> {busy ? 'Exporting…' : 'Export collection'}</button></div>
                    {preview && <section className={`git-sync-preview git-sync-preview--${preview.state}`}><div><span className="git-sync-eyebrow">Sync preview</span><h4>{preview.state === 'conflict' ? 'Changes on both sides' : preview.state.replace(/-/g, ' ')}</h4><p>{preview.summary.additions} additions · {preview.summary.modifications} modifications · {preview.summary.deletions} deletions · {preview.summary.unchanged} unchanged</p></div>{preview.state === 'in-sync' ? <span className="git-sync-state"><FiCheckCircle /> In sync</span> : <div className="git-sync-actions">{preview.state === 'conflict' && <button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={openConflictEditor}>Resolve conflicts</button>}<button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => applySync('import')} disabled={busy}>Import local</button><button type="button" className="git-sync-btn git-sync-btn--primary" onClick={() => applySync('export')} disabled={busy}>Export Pigeon</button></div>}<details><summary>Review request changes</summary><div className="git-sync-diff"><span>Added: {preview.requests.additions.map((item) => item.name).join(', ') || '—'}</span><span>Modified: {preview.requests.modifications.map((item) => item.name).join(', ') || '—'}</span><span>Deleted locally: {preview.requests.deletions.map((item) => item.name).join(', ') || '—'}</span></div></details></section>}
                </>
            )}

            {showConnect && <div className="git-sync-overlay" role="dialog" aria-modal="true" aria-label="Connect local repository" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowConnect(false); }}><form className="git-sync-modal" onSubmit={connect}><header><div><span className="git-sync-eyebrow"><FiGitBranch /> Local-first</span><h3>Connect repository</h3></div><button type="button" className="git-sync-icon-btn" aria-label="Close repository connection form" onClick={() => setShowConnect(false)}><FiX /></button></header><p>Use an existing local folder. No Git initialization, staging, commit, or push is performed here.</p><label>Repository path<input required value={form.repositoryPath} placeholder="C:\\Projects\\my-api" onChange={(event) => setForm((current) => ({ ...current, repositoryPath: event.target.value }))} /></label><label>Relative Pigeon path<input value={form.relativeCollectionPath} placeholder=".pigeon/collections/my-api" onChange={(event) => setForm((current) => ({ ...current, relativeCollectionPath: event.target.value }))} /></label><label className="git-sync-toggle"><input type="checkbox" checked={form.includeWorkflows} onChange={(event) => setForm((current) => ({ ...current, includeWorkflows: event.target.checked }))} /> Include workflows</label><label className="git-sync-toggle"><input type="checkbox" checked={form.includeEnvironmentTemplates} onChange={(event) => setForm((current) => ({ ...current, includeEnvironmentTemplates: event.target.checked }))} /> Include environment templates</label><footer><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setShowConnect(false)}>Cancel</button><button className="git-sync-btn git-sync-btn--primary" disabled={busy}>{busy ? 'Connecting…' : 'Connect repository'}</button></footer></form></div>}
            {gitAction && <div className="git-sync-overlay" role="dialog" aria-modal="true" aria-label="Confirm Git action"><div className="git-sync-modal"><header><div><span className="git-sync-eyebrow"><FiGitBranch /> Confirmation required</span><h3>{gitAction === 'init' ? 'Initialize Git repository' : gitAction === 'stage' ? 'Stage Pigeon files' : 'Commit Pigeon files'}</h3></div><button type="button" className="git-sync-icon-btn" aria-label="Close confirmation" onClick={() => setGitAction('')}><FiX /></button></header><p>{gitAction === 'init' ? 'This creates Git metadata in the connected folder.' : 'Only files listed in this collection’s Pigeon manifest will be affected.'}</p>{gitAction === 'commit' && <label>Commit message<input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} /></label>}<footer><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setGitAction('')}>Cancel</button><button type="button" className="git-sync-btn git-sync-btn--primary" disabled={busy} onClick={runGitAction}>{busy ? 'Working…' : 'Confirm'}</button></footer></div></div>}
            {conflictEditor && <div className="git-sync-overlay" role="dialog" aria-modal="true" aria-label="Resolve synchronization conflicts"><div className="git-sync-modal git-sync-conflicts"><header><div><span className="git-sync-eyebrow">Conflict resolution</span><h3>Resolve request changes</h3></div><button type="button" className="git-sync-icon-btn" aria-label="Close conflict resolution" onClick={() => setConflictEditor(false)}><FiX /></button></header><p>Choose a value for each changed request. Manual JSON must include name, method, and url.</p>{preview.requests.modifications.map((item) => { const current = resolutions[item.id] || { choice: 'local', manualText: JSON.stringify(item.local, null, 2) }; return <article className="git-sync-conflict" key={item.id}><strong>{item.name}</strong><div className="git-sync-choice"><button type="button" className={current.choice === 'pigeon' ? 'active' : ''} onClick={() => setResolutions((all) => ({ ...all, [item.id]: { ...current, choice: 'pigeon' } }))}>Use Pigeon</button><button type="button" className={current.choice === 'local' ? 'active' : ''} onClick={() => setResolutions((all) => ({ ...all, [item.id]: { ...current, choice: 'local' } }))}>Use local</button><button type="button" className={current.choice === 'both' ? 'active' : ''} onClick={() => setResolutions((all) => ({ ...all, [item.id]: { ...current, choice: 'both' } }))}>Keep both</button><button type="button" className={current.choice === 'manual' ? 'active' : ''} onClick={() => setResolutions((all) => ({ ...all, [item.id]: { ...current, choice: 'manual' } }))}>Manual JSON</button></div>{current.choice === 'manual' && <textarea value={current.manualText} onChange={(event) => setResolutions((all) => ({ ...all, [item.id]: { ...current, manualText: event.target.value } }))} spellCheck={false} />}</article>; })}<footer><button type="button" className="git-sync-btn git-sync-btn--ghost" onClick={() => setConflictEditor(false)}>Cancel</button><button type="button" className="git-sync-btn git-sync-btn--primary" disabled={busy} onClick={applyConflictResolutions}>Apply resolutions</button></footer></div></div>}
        </section>
    );
};

export default CollectionGitSyncPanel;
