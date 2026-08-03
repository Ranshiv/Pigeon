import React, { useCallback, useEffect, useState } from 'react';
import './DocumentationContentVersionHistory.css';

const DocumentationContentVersionHistory = ({ collectionId, documentation, onContentRestore }) => {
  const [versions, setVersions] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedVersions, setExpandedVersions] = useState(() => new Set());
  const [restoringId, setRestoringId] = useState('');

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/collections/${collectionId}/documentation/versions?page=${page}&limit=20`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to fetch documentation versions.');
      setVersions(data.versions || []);
      setTotal(data.total || 0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [collectionId, page]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleRestore = async (versionId) => {
    setRestoringId(versionId);
    setError('');
    try {
      const response = await fetch(`/api/collections/${collectionId}/documentation/versions/${versionId}/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ revision: Number(documentation?.revision || 0) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to restore documentation version.');
      onContentRestore?.(data.documentation);
      await fetchVersions();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRestoringId('');
    }
  };

  const toggleExpanded = (versionId) => {
    setExpandedVersions((current) => {
      const next = new Set(current);
      if (next.has(versionId)) next.delete(versionId); else next.add(versionId);
      return next;
    });
  };

  if (loading) return <div className="version-history-loading">Loading version history…</div>;

  return (
    <div className="documentation-version-history">
      <div className="version-history-header"><h3>Documentation versions</h3><p>Immutable content and settings snapshots. Restoring creates a new revision.</p></div>
      {error ? <div className="version-history-error" role="alert">{error}</div> : null}
      {versions.length === 0 ? <div className="no-versions">No documentation versions have been saved yet.</div> : (
        <div className="versions-list">
          {versions.map((version) => (
            <div key={version._id} className="version-item">
              <div className="version-header" onClick={() => toggleExpanded(version._id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') toggleExpanded(version._id); }}>
                <div className="version-info"><strong>Revision {version.revision}</strong><span className="version-date">{new Date(version.createdAt).toLocaleString()}</span><span className="version-changes">{version.message || version.source || 'Documentation updated'}</span></div>
                <div className="version-actions">
                  <button type="button" className="restore-btn" disabled={Boolean(restoringId)} onClick={(event) => { event.stopPropagation(); handleRestore(version._id); }}>{restoringId === version._id ? 'Restoring…' : 'Restore as new revision'}</button>
                  <span className={`expand-icon ${expandedVersions.has(version._id) ? 'expanded' : ''}`}>▼</span>
                </div>
              </div>
              {expandedVersions.has(version._id) ? <div className="version-content"><div className="comparison-stats"><span>Source: {version.source || 'manual'}</span><span>{(version.content || '').length} characters</span></div><pre className="content-text">{(version.content || '').slice(0, 2000)}{(version.content || '').length > 2000 ? '…' : ''}</pre></div> : null}
            </div>
          ))}
        </div>
      )}
      {total > 20 ? <div className="version-history-footer"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {Math.ceil(total / 20)}</span><button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Next</button></div> : null}
    </div>
  );
};

export default DocumentationContentVersionHistory;
