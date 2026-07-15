import React, { useState, useEffect, useCallback } from 'react';
import {
    FiChevronDown,
    FiGitBranch,
    FiDownload,
    FiRefreshCw,
    FiAlertTriangle,
    FiCheckCircle,
    FiInfo,
    FiSearch,
    FiShield
} from 'react-icons/fi';
import DiffSummaryCard from './DiffSummaryCard';
import DiffComparisonPanel from './DiffComparisonPanel';
import ChangesList from './ChangesList';
import './ContractDiffViewer.css';
import './ContractDiffViewer_Enhanced.css';

const ContractDiffViewer = ({
    workspaceId, // eslint-disable-line react/prop-types
    collectionId, // eslint-disable-line react/prop-types
    onVersionCompare // eslint-disable-line react/prop-types
}) => {
    const [availableVersions, setAvailableVersions] = useState([]);
    const [selectedVersion1, setSelectedVersion1] = useState(null);
    const [selectedVersion2, setSelectedVersion2] = useState(null);
    const [comparisonResult, setComparisonResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, breaking, non-breaking

    // Reset selections when collection changes to ensure clean state
    useEffect(() => {
        setSelectedVersion1(null);
        setSelectedVersion2(null);
        setComparisonResult(null);
        setError(null);
        setSearchTerm('');
        setActiveTab('summary');
        setFilterType('all');
    }, [collectionId]);

    // Force clean state on component mount
    useEffect(() => {
        setSelectedVersion1(null);
        setSelectedVersion2(null);
        setComparisonResult(null);
    }, []);

    // Load available versions - simplified to prevent infinite loops
    useEffect(() => {
        if (!collectionId) return;

        const loadVersions = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/api-versions/collections/${collectionId}/versions`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to load API versions');
                }

                const data = await response.json();
                const versions = data.versions || [];
                setAvailableVersions(versions);

            } catch (err) {
                console.error('Error loading versions:', err);
                setError('Failed to load API versions');
                setAvailableVersions([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadVersions();
    }, [collectionId]); // Only depend on collectionId

    // Manual comparison function - no auto-trigger
    const handleCompareVersions = useCallback(async () => {
        if (!selectedVersion1 || !selectedVersion2) {
            setError('Please select two versions to compare');
            setComparisonResult(null);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const compareUrl = `/api/api-versions/versions/${selectedVersion1._id}/compare/${selectedVersion2._id}`;

            const response = await fetch(compareUrl, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to compare versions');
            }

            const result = await response.json();
            setComparisonResult(result);

            // Only call callback if it exists and result is valid
            if (onVersionCompare && result) {
                onVersionCompare(result);
            }
        } catch (err) {
            console.error('Error comparing versions:', err);
            setError('Failed to compare versions');
            setComparisonResult(null);
        } finally {
            setIsLoading(false);
        }
    }, [selectedVersion1, selectedVersion2, onVersionCompare]);

    const handleExportReport = () => {
        if (!comparisonResult) return;

        const report = {
            comparison: comparisonResult,
            versions: {
                from: selectedVersion1,
                to: selectedVersion2
            },
            generatedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract-diff-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formatVersionName = (version) => {
        if (!version) return 'Unknown Version';
        return `${version.name || 'Unnamed'} (${new Date(version.createdAt).toLocaleDateString()})`;
    };

    // Clear selections function
    const clearSelections = useCallback(() => {
        setSelectedVersion1(null);
        setSelectedVersion2(null);
        setComparisonResult(null);
        setError(null);
        setSearchTerm('');
    }, []);

    const refreshVersions = () => {
        clearSelections();
        window.location.reload();
    };

    const filteredChanges = comparisonResult?.changes?.filter(change => {
        const pathText = (change?.path ?? '').toString().toLowerCase();
        const descText = (change?.description ?? '').toString().toLowerCase();
        const term = (searchTerm ?? '').toString().toLowerCase();

        const matchesSearch = !term || pathText.includes(term) || descText.includes(term);

        const matchesFilter = filterType === 'all' ||
            (filterType === 'breaking' && change.breaking) ||
            (filterType === 'non-breaking' && !change.breaking);

        return matchesSearch && matchesFilter;
    }) || [];

    // Early returns for loading, error, and empty states
    if (isLoading && availableVersions.length === 0) {
        return (
            <div className="contract-diff-viewer">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading API versions...</p>
                </div>
            </div>
        );
    }

    if (error && availableVersions.length === 0) {
        return (
            <div className="contract-diff-viewer">
                <div className="error-state">
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button onClick={refreshVersions} className="retry-btn">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (availableVersions.length === 0) {
        return (
            <div className="contract-diff-viewer">
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No API Versions Found</h3>
                    <p>
                        To use Contract Diff & Breaking Changes analysis, you need to save your API designs as versions first.
                    </p>
                    <div className="empty-actions">
                        <div className="help-text">
                            <strong>How to create versions:</strong>
                            <ol>
                                <li>Design your API using the visual designer</li>
                                <li>Click "Save as Version" in the toolbar</li>
                                <li>Come back here to compare versions</li>
                            </ol>
                        </div>
                        <button
                            onClick={refreshVersions}
                            className="refresh-btn"
                        >
                            Refresh to Check for Versions
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="contract-diff-viewer" key={`contract-diff-${collectionId}`}>
            {/* Header Section */}
            <div className="diff-header">
                <div className="diff-title">
                    <FiGitBranch className="title-icon" />
                    <h2>Contract Diff & Breaking Changes</h2>
                </div>

                <div className="diff-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={refreshVersions}
                        disabled={isLoading}
                        title="Refresh versions"
                    >
                        <FiRefreshCw className={isLoading ? 'spinning' : ''} />
                    </button>

                    {comparisonResult && (
                        <button
                            className="btn btn-primary"
                            onClick={handleExportReport}
                            title="Export diff report"
                        >
                            <FiDownload />
                            Export Report
                        </button>
                    )}
                </div>
            </div>

            {/* Version Selection */}
            <div className="version-selection">
                <div className="version-selector">
                    <label htmlFor="compare-from-select">Compare From:</label>
                    <div className="select-wrapper">
                        <select
                            id="compare-from-select"
                            value={selectedVersion1?._id || ''}
                            onChange={(e) => {
                                const version = e.target.value ? availableVersions.find(v => v._id === e.target.value) : null;
                                setSelectedVersion1(version);
                                setComparisonResult(null); // Clear previous results
                                setError(null); // Clear any errors
                            }}
                            disabled={isLoading}

                        >
                            <option value="" className="placeholder-option">
                                Select version...
                            </option>
                            {availableVersions.map(version => (
                                <option key={version._id} value={version._id}>
                                    {formatVersionName(version)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="version-selector">
                    <label htmlFor="compare-to-select">Compare To:</label>
                    <div className="select-wrapper">
                        <select
                            id="compare-to-select"
                            value={selectedVersion2?._id || ''}
                            onChange={(e) => {
                                const version = e.target.value ? availableVersions.find(v => v._id === e.target.value) : null;
                                setSelectedVersion2(version);
                                setComparisonResult(null); // Clear previous results
                                setError(null); // Clear any errors
                            }}
                            disabled={isLoading}

                        >
                            <option value="" className="placeholder-option">
                                Select version...
                            </option>
                            {availableVersions.map(version => (
                                <option key={version._id} value={version._id}>
                                    {formatVersionName(version)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="compare-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleCompareVersions}
                        disabled={!selectedVersion1 || !selectedVersion2 || isLoading}
                        title="Compare selected versions"
                    >
                        <FiGitBranch />
                        {isLoading ? 'Comparing...' : 'Compare Versions'}
                    </button>

                    {(selectedVersion1 || selectedVersion2) && (
                        <button
                            className="btn btn-outline"
                            onClick={clearSelections}
                            disabled={isLoading}
                            title="Clear selections"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-banner">
                    <FiAlertTriangle />
                    <span>{error}</span>
                </div>
            )}

            {/* Comparison Results */}
            {comparisonResult && (
                <>
                    {/* Search and Filter Controls */}
                    <div className="diff-controls">
                        <div className="search-box">
                            <FiSearch className="search-icon" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search changes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-controls">
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                <option value="all">All Changes</option>
                                <option value="breaking">Breaking Changes</option>
                                <option value="non-breaking">Non-Breaking</option>
                            </select>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="diff-tabs">
                        <button
                            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                            onClick={() => setActiveTab('summary')}
                        >
                            <FiInfo />
                            Summary
                        </button>
                        <button
                            className={`tab ${activeTab === 'changes' ? 'active' : ''}`}
                            onClick={() => setActiveTab('changes')}
                        >
                            <FiCheckCircle />
                            Changes ({filteredChanges.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comparison')}
                        >
                            <FiGitBranch />
                            Side-by-Side
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="tab-content">
                        {activeTab === 'summary' && (
                            <DiffSummaryCard
                                comparisonResult={comparisonResult}
                                version1={selectedVersion1}
                                version2={selectedVersion2}
                            />
                        )}

                        {activeTab === 'changes' && (
                            <ChangesList
                                changes={filteredChanges}
                                searchTerm={searchTerm}
                                filterType={filterType}
                            />
                        )}

                        {activeTab === 'comparison' && (
                            <DiffComparisonPanel
                                version1={selectedVersion1}
                                version2={selectedVersion2}
                                comparisonResult={comparisonResult}
                            />
                        )}
                    </div>
                </>
            )}

            {/* Default State - No Comparison Selected */}
            {!comparisonResult && !isLoading && availableVersions.length > 0 && (
                <div className="default-state">
                    {/* Controls aligned the same as results */}
                    <div className="diff-controls">
                        <div className="search-box">
                            <FiSearch className="search-icon" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search changes..."
                                value=""
                                disabled
                            />
                        </div>

                        <div className="filter-controls">
                            <select disabled>
                                <option>All Changes</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabs positioned consistently */}
                    <div className="diff-tabs">
                        <button className="tab active">
                            <FiInfo />
                            Summary
                        </button>
                        <button className="tab" disabled>
                            <FiCheckCircle />
                            Changes (0)
                        </button>
                        <button className="tab" disabled>
                            <FiGitBranch />
                            Side-by-Side
                        </button>
                    </div>

                    {/* Content area mirrors results tab-content */}
                    <div className="tab-content">
                        {/* No Comparison Message - Replace hardcoded summary cards */}
                        <div className="no-comparison-state">
                            <div className="no-comparison-icon">
                                <FiGitBranch />
                            </div>
                            <h3>No Comparison Selected</h3>
                            <p>
                                Select two versions from the dropdowns above and click
                                "Compare Versions" to see detailed changes and analysis.
                            </p>
                            <div className="comparison-benefits">
                                <h4>What you'll see after comparison:</h4>
                                <ul>
                                    <li><FiInfo /> Total changes between versions</li>
                                    <li><FiAlertTriangle /> Breaking changes that may affect clients</li>
                                    <li><FiCheckCircle /> Safe changes that are backward compatible</li>
                                    <li><FiShield /> Overall compatibility score</li>
                                </ul>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleCompareVersions}
                                disabled={!selectedVersion1 || !selectedVersion2 || isLoading}
                            >
                                <FiGitBranch />
                                {(() => {
                                    if (!selectedVersion1 || !selectedVersion2) {
                                        return 'Select versions to compare';
                                    }
                                    if (isLoading) {
                                        return 'Comparing...';
                                    }
                                    return 'Compare Versions';
                                })()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContractDiffViewer;
