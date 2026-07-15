import React, { useState, useEffect } from 'react';
import './DocumentationContentVersionHistory.css';

const DocumentationContentVersionHistory = ({ collectionId, onContentRestore }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedVersions, setExpandedVersions] = useState(new Set());
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchVersions();
  }, [collectionId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/collections/${collectionId}/content/versions`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }
      
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId) => {
    try {
      setRestoring(true);
      const response = await fetch(`/api/collections/${collectionId}/content/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ versionId }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

      const data = await response.json();
      setSuccessMessage('Content restored successfully!');
      
      // Call the parent callback to refresh the content
      if (onContentRestore) {
        onContentRestore(data.content);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh version history
      fetchVersions();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const toggleExpanded = (versionId) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getChangesPreview = (content, previousContent) => {
    if (!previousContent) return 'Initial version';
    
    const currentLength = content.length;
    const previousLength = previousContent.length;
    const diff = currentLength - previousLength;
    
    if (diff > 0) {
      return `+${diff} characters added`;
    } else if (diff < 0) {
      return `${Math.abs(diff)} characters removed`;
    } else {
      return 'Content modified';
    }
  };

  if (loading) {
    return <div className="version-history-loading">Loading version history...</div>;
  }

  if (error) {
    return <div className="version-history-error">Error: {error}</div>;
  }

  return (
    <div className="documentation-version-history">
      <div className="version-history-header">
        <h3>Content Version History</h3>
        <p>Last 5 changes to this document</p>
      </div>

      {successMessage && (
        <div className="version-history-success">
          {successMessage}
        </div>
      )}

      {versions.length === 0 ? (
        <div className="no-versions">
          No version history available for this document.
        </div>
      ) : (
        <div className="versions-list">
          {versions.map((version, index) => (
            <div key={version._id} className="version-item">
              <div className="version-header" onClick={() => toggleExpanded(version._id)}>
                <div className="version-info">
                  <span className="version-date">{formatDate(version.createdAt)}</span>
                  <span className="version-changes">
                    {getChangesPreview(version.content, index < versions.length - 1 ? versions[index + 1].content : null)}
                  </span>
                </div>
                <div className="version-actions">
                  <button
                    className="restore-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to restore this version? Current changes will be saved as a new version.')) {
                        handleRestore(version._id);
                      }
                    }}
                    disabled={restoring}
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <span className={`expand-icon ${expandedVersions.has(version._id) ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>
              
              {expandedVersions.has(version._id) && (
                <div className="version-content">
                  <div className="content-preview">
                    <h4>Content Preview:</h4>
                    <div className="content-text">
                      {version.content.substring(0, 500)}
                      {version.content.length > 500 && '...'}
                    </div>
                  </div>
                  
                  {index < versions.length - 1 && (
                    <div className="content-comparison">
                      <h4>Changes from Previous Version:</h4>
                      <div className="comparison-stats">
                        <span>Characters: {version.content.length}</span>
                        <span>Previous: {versions[index + 1].content.length}</span>
                        <span>Difference: {version.content.length - versions[index + 1].content.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {versions.length >= 5 && (
        <div className="version-history-footer">
          <p>Showing last 5 versions. Older versions are automatically archived.</p>
        </div>
      )}
    </div>
  );
};

export default DocumentationContentVersionHistory;