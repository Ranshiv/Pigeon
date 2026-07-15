// client/src/components/HistorySection.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './HistorySection.css';
import { FiClock, FiSearch, FiFilter, FiX } from 'react-icons/fi';
import PageLoader from './common/PageLoader/PageLoader';

// Group history entries by date categories without using date-fns comparison functions
const groupHistoryByDate = (history) => {
    const grouped = {
        today: [],
        yesterday: [],
        thisWeek: [],
        thisMonth: [],
        older: []
    };

    // Get today's date at midnight for comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calculate start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    // Calculate start of month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    history.forEach(entry => {
        try {
            const entryDate = new Date(entry.timestamp);
            const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

            // Check if date is today
            if (entryDay.getTime() === today.getTime()) {
                grouped.today.push(entry);
            }
            // Check if date is yesterday
            else if (entryDay.getTime() === yesterday.getTime()) {
                grouped.yesterday.push(entry);
            }
            // Check if date is this week
            else if (entryDay >= startOfWeek && entryDay < today) {
                grouped.thisWeek.push(entry);
            }
            // Check if date is this month
            else if (entryDate >= startOfMonth && entryDay < startOfWeek) {
                grouped.thisMonth.push(entry);
            }
            // Otherwise it's older
            else {
                grouped.older.push(entry);
            }
        } catch (e) {
            grouped.older.push(entry);
        }
    });

    return grouped;
};

const HistorySection = ({ history = [], onSelectHistory, selectedId, loading = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    if (!Array.isArray(history)) {
        console.error("History prop is not an array:", history);
        return <div className="hst-root hst-root--error">Error loading history data.</div>;
    }

    // Loading state with PageLoader
    if (loading) {
        return (
            <div className="hst-root hst-root--loading">
                <div className="hst-header">
                    <h2 className="hst-title"><FiClock /> Request History</h2>
                </div>
                <div className="hst-loading-container">
                    <PageLoader size="lg" label="Fetching your request history..." />
                </div>
            </div>
        );
    }

    // Filter and Sort history based on search and method filter
    const filteredHistory = history
        .filter(entry => {
            const matchesSearch = searchTerm === '' ||
                entry.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (entry.method && entry.method.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesFilter = activeFilter === 'all' ||
                (entry.method && entry.method.toLowerCase() === activeFilter);

            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Group the filtered and sorted history
    const groupedHistory = groupHistoryByDate(filteredHistory);

    // Calculate test results stats for each history entry
    const getTestResultsSummary = (entry) => {
        if (!entry.testResults || !Array.isArray(entry.testResults) || entry.testResults.length === 0) {
            return null;
        }

        const totalTests = entry.testResults.length;
        const passedTests = entry.testResults.filter(test => test.passed).length;

        return { total: totalTests, passed: passedTests };
    };

    // Handle method filter clicks
    const handleFilterClick = (method) => {
        setActiveFilter(activeFilter === method ? 'all' : method);
    };

    // Format time without date-fns
    const formatTimeOnly = (dateStr) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    // Empty state
    if (history.length === 0) {
        return (
            <div className="hst-root hst-root--empty">
                <div className="hst-header">
                    <h2 className="hst-title"><FiClock /> Request History</h2>
                </div>
                <div className="hst-empty-state">
                    <div className="hst-empty-icon">📡</div>
                    <p className="hst-empty-text">No history yet. Send some requests!</p>
                </div>
            </div>
        );
    }

    // Filtered to empty state
    if (filteredHistory.length === 0) {
        return (
            <div className="hst-root">
                <div className="hst-header">
                    <h2 className="hst-title"><FiClock /> Request History</h2>
                    <div className="hst-search-container">
                        <FiSearch className="hst-search-icon" />
                        <input
                            type="text"
                            className="hst-search-input"
                            placeholder="Search history..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <FiX
                                className="hst-clear-search"
                                onClick={() => setSearchTerm('')}
                                title="Clear search"
                            />
                        )}
                    </div>
                    <div className="hst-tabs">
                        {['get', 'post', 'put', 'delete', 'patch'].map(method => (
                            <button
                                key={method}
                                className={`hst-tab hst-tab--method-${method} ${activeFilter === method ? 'hst-tab--active' : ''}`}
                                onClick={() => handleFilterClick(method)}
                                title={`Filter ${method.toUpperCase()} requests`}
                            >
                                {method.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="hst-empty-state">
                    <FiFilter className="hst-empty-icon" />
                    <p className="hst-empty-text">No matching requests found.</p>
                    <button
                        className="hst-btn hst-btn--primary hst-reset-btn"
                        onClick={() => {
                            setSearchTerm('');
                            setActiveFilter('all');
                        }}
                    >
                        Reset filters
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="hst-root">
            <div className="hst-header">
                <h2 className="hst-title"><FiClock /> Request History</h2>
                <div className="hst-search-container">
                    <FiSearch className="hst-search-icon" />
                    <input
                        type="text"
                        className="hst-search-input"
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <FiX
                            className="hst-clear-search"
                            onClick={() => setSearchTerm('')}
                            title="Clear search"
                        />
                    )}
                </div>
                <div className="hst-tabs">
                    {['get', 'post', 'put', 'delete', 'patch'].map(method => (
                        <button
                            key={method}
                            className={`hst-tab hst-tab--method-${method} ${activeFilter === method ? 'hst-tab--active' : ''}`}
                            onClick={() => handleFilterClick(method)}
                            title={`Filter ${method.toUpperCase()} requests`}
                        >
                            {method.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="hst-content">
                {/* Today's requests */}
                {groupedHistory.today.length > 0 && (
                    <div className="hst-group">
                        <h3 className="hst-group-title">Today</h3>
                        <ul className="hst-list">
                            {groupedHistory.today.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* Yesterday's requests */}
                {groupedHistory.yesterday.length > 0 && (
                    <div className="hst-group">
                        <h3 className="hst-group-title">Yesterday</h3>
                        <ul className="hst-list">
                            {groupedHistory.yesterday.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* This week's requests */}
                {groupedHistory.thisWeek.length > 0 && (
                    <div className="hst-group">
                        <h3 className="hst-group-title">Earlier this week</h3>
                        <ul className="hst-list">
                            {groupedHistory.thisWeek.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* This month's requests */}
                {groupedHistory.thisMonth.length > 0 && (
                    <div className="hst-group">
                        <h3 className="hst-group-title">Earlier this month</h3>
                        <ul className="hst-list">
                            {groupedHistory.thisMonth.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* Older requests */}
                {groupedHistory.older.length > 0 && (
                    <div className="hst-group">
                        <h3 className="hst-group-title">Older</h3>
                        <ul className="hst-list">
                            {groupedHistory.older.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );

    // Helper function to render each history item
    function renderHistoryItem(entry) {
        const testResults = getTestResultsSummary(entry);
        // Derive a human-friendly URL for the sidebar
        let displayUrl = '';
        let urlTip = entry?.url || 'No URL';
        try {
            if (entry?.url) {
                const parsed = new URL(entry.url, 'http://example.com');
                const isAbsolute = /^(https?:)\/\//i.test(entry.url) && parsed.hostname;

                if (isAbsolute) {
                    // Show hostname + path (+ query if present) for absolute URLs
                    displayUrl = `${parsed.hostname}${parsed.pathname}${parsed.search || ''}`;
                } else {
                    // Relative path – try to include host header if available
                    const host = entry.headers?.host || entry.host || '';
                    displayUrl = `${host}${parsed.pathname}${parsed.search || ''}` || parsed.pathname;
                }
            }
        } catch (e) {
            // Fall back to raw string if URL parsing fails
            displayUrl = entry?.url || '';
        }

        const shortUrl = displayUrl.length > 50 ? displayUrl.substring(0, 50) + '...' : displayUrl;

        return (
            <li
                key={entry._id}
                className={`hst-item ${selectedId === entry._id ? 'hst-item--active' : ''}`}
                onClick={() => onSelectHistory(entry)}
                title={`View details for ${entry.method} ${urlTip}`}
            >
                <div className="hst-item-header">
                    <span className={`hst-method-badge hst-method-badge--${entry.method?.toLowerCase()}`}>
                        {entry.method}
                    </span>
                    <span className="hst-item-url" title={urlTip}>{shortUrl || '/'}</span>
                </div>
                <div className="hst-item-meta">
                    <span className={`hst-status-badge hst-status-badge--${String(entry.responseStatus || 0).charAt(0)}xx`}>
                        {entry.responseStatus || 'N/A'}
                    </span>

                    {/* Test Results Badge */}
                    {testResults && (
                        <span className={`hst-test-badge ${testResults.passed === testResults.total ? 'hst-test-badge--passed' : 'hst-test-badge--failed'}`}
                            title={`Tests: ${testResults.passed}/${testResults.total} passed`}>
                            {testResults.passed}/{testResults.total} tests
                        </span>
                    )}

                    <span className="hst-item-time">{formatTimeOnly(entry.timestamp)}</span>
                </div>
            </li>
        );
    }
};

// Add prop types for better development experience
HistorySection.propTypes = {
    history: PropTypes.arrayOf(PropTypes.shape({
        _id: PropTypes.string.isRequired,
        method: PropTypes.string,
        url: PropTypes.string,
        responseStatus: PropTypes.number,
        timestamp: PropTypes.string,
        testResults: PropTypes.array
    })),
    onSelectHistory: PropTypes.func.isRequired,
    selectedId: PropTypes.string,
    loading: PropTypes.bool,
};

export default HistorySection;
