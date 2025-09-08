import React, { useState } from 'react';
import ApiDiffViewer from './ApiDiffViewer';

// Demo component to test the improved ApiDiffViewer
const ApiDiffDemo = () => {
    const [showModal, setShowModal] = useState(false);

    // Mock diff result data for testing
    const mockDiffResult = {
        baseVersion: 'v1.0.0',
        newVersion: 'v2.0.0',
        summary: {
            totalChanges: 15,
            breakingChanges: 3,
            nonBreakingChanges: 12,
            addedEndpoints: 2,
            removedEndpoints: 1,
            modifiedEndpoints: 4
        },
        breakingChanges: [
            {
                type: 'breaking',
                action: 'delete',
                location: 'paths./users/{id}.delete',
                description: 'Removed DELETE operation for /users/{id}',
                severity: 'error'
            },
            {
                type: 'breaking',
                action: 'modify',
                location: 'paths./users.post.requestBody',
                description: 'Made email field required in user creation',
                severity: 'error'
            },
            {
                type: 'breaking',
                action: 'modify',
                location: 'components.schemas.User.properties.id',
                description: 'Changed user ID format from integer to UUID',
                severity: 'warning'
            }
        ],
        hasBreakingChanges: true,
        changelogGenerated: `# API Changes v1.0.0 → v2.0.0

## 🚨 Breaking Changes
- **REMOVED**: DELETE /users/{id} operation
- **MODIFIED**: Email field is now required for user creation
- **CHANGED**: User ID format changed from integer to UUID

## ✅ Non-Breaking Changes
- **ADDED**: GET /organizations endpoint
- **ADDED**: GET /users/{id}/profile endpoint
- **ENHANCED**: Added pagination support to GET /users
- **IMPROVED**: Better error responses with detailed messages`,
        diffResult: {
            changes: [
                { type: 'addition', path: '/organizations', description: 'Added new organizations endpoint' },
                { type: 'deletion', path: '/users/{id}', method: 'DELETE', description: 'Removed delete user endpoint' },
                { type: 'modification', path: '/users', method: 'POST', description: 'Modified user creation schema' }
            ]
        }
    };

    // Custom ApiDiffViewer component that accepts mock data
    const TestApiDiffViewer = ({ onClose }) => {
        const [diffResult, setDiffResult] = useState(mockDiffResult);
        const [isLoading, setIsLoading] = useState(false);
        const [error, setError] = useState(null);

        // Use the same component structure as ApiDiffViewer but with mock data
        return (
            <div className="api-diff-viewer">
                <div className="modal-container">
                    <div className="diff-header">
                        <div className="header-content">
                            <h3>🔄 API Diff Analysis (Demo)</h3>
                            <div className="version-info">
                                <span className="version-badge base">Base: {diffResult.baseVersion}</span>
                                <span className="arrow">→</span>
                                <span className="version-badge new">New: {diffResult.newVersion}</span>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="download-group">
                                <button className="download-btn" title="Download HTML Report">
                                    📄 HTML
                                </button>
                                <button className="download-btn" title="Download Markdown Report">
                                    📝 MD
                                </button>
                                <button className="download-btn" title="Download JSON Report">
                                    📊 JSON
                                </button>
                            </div>
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>
                    </div>

                    <div className="diff-content">
                        {/* Summary Section */}
                        <div className="diff-section">
                            <div className="section-header">
                                <h4>📊 Summary</h4>
                                <div className="summary-badges">
                                    <span className="badge breaking">3 Breaking</span>
                                    <span className="badge total">15 Total Changes</span>
                                </div>
                            </div>
                            <div className="section-content">
                                <div className="summary-grid">
                                    <div className="summary-card breaking">
                                        <h3>{diffResult.summary.breakingChanges}</h3>
                                        <p>Breaking Changes</p>
                                    </div>
                                    <div className="summary-card non-breaking">
                                        <h3>{diffResult.summary.nonBreakingChanges}</h3>
                                        <p>Non-Breaking Changes</p>
                                    </div>
                                    <div className="summary-card added">
                                        <h3>{diffResult.summary.addedEndpoints}</h3>
                                        <p>Added Endpoints</p>
                                    </div>
                                    <div className="summary-card removed">
                                        <h3>{diffResult.summary.removedEndpoints}</h3>
                                        <p>Removed Endpoints</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Breaking Changes Section */}
                        <div className="diff-section">
                            <div className="section-header">
                                <h4>🚨 Breaking Changes ({diffResult.breakingChanges.length})</h4>
                            </div>
                            <div className="section-content">
                                <div className="changes-list">
                                    {diffResult.breakingChanges.map((change, index) => (
                                        <div key={index} className={`change-item ${change.severity}`}>
                                            <div className="change-header">
                                                <span className="change-type">{change.action.toUpperCase()}</span>
                                                <span className="change-location">{change.location}</span>
                                                <span className={`severity-badge ${change.severity}`}>{change.severity}</span>
                                            </div>
                                            <p className="change-description">{change.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Changelog Section */}
                        <div className="diff-section">
                            <div className="section-header">
                                <h4>📝 Generated Changelog</h4>
                            </div>
                            <div className="section-content">
                                <div className="changelog-content">
                                    <pre>{diffResult.changelogGenerated}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>API Diff Viewer - Demo</h2>
            <p>This demonstrates the improved Contract Diff & Breaking Change Detection UI.</p>

            <button
                onClick={() => setShowModal(true)}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                }}
            >
                🔄 Show API Diff Demo
            </button>

            {showModal && (
                <TestApiDiffViewer onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

export default ApiDiffDemo;
