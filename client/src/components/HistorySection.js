// src/components/HistorySection.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './HistorySection.css';
import { FiClock, FiSearch, FiFilter, FiX } from 'react-icons/fi';


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
        return <div className="history-section error">Error loading history data.</div>;
    }

    // Loading state with skeleton
    if (loading) {
        return (
            <div className="history-section loading">
                <div className="history-header">
                    <h2><FiClock /> Request History</h2>
                </div>
                <div className="loading-state">
                    <div className="loading-spinner-history"></div>
                    <h3>Loading History</h3>
                    <p>Fetching your request history...</p>
                </div>
            </div>
        );
    }

    // Filter history based on search and method filter
    const filteredHistory = history.filter(entry => {
        const matchesSearch = searchTerm === '' ||
            entry.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.method && entry.method.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesFilter = activeFilter === 'all' ||
            (entry.method && entry.method.toLowerCase() === activeFilter);

        return matchesSearch && matchesFilter;
    });

    // Group the filtered history
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
            <div className="history-section empty">
                <div className="history-header">
                    <h2><FiClock /> Request History</h2>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">📡</div>
                    <p>No history yet. Send some requests!</p>
                </div>
            </div>
        );
    }

    // Filtered to empty state
    if (filteredHistory.length === 0) {
        return (
            <div className="history-section">
                <div className="history-header">
                    <h2><FiClock /> Request History</h2>
                    <div className="history-search">
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search history..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <FiX
                                className="clear-search"
                                onClick={() => setSearchTerm('')}
                                title="Clear search"
                            />
                        )}
                    </div>
                    <div className="method-filters">
                        {['get', 'post', 'put', 'delete', 'patch'].map(method => (
                            <button
                                key={method}
                                className={`filter-btn method-${method} ${activeFilter === method ? 'active' : ''}`}
                                onClick={() => handleFilterClick(method)}
                                title={`Filter ${method.toUpperCase()} requests`}
                            >
                                {method.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="empty-state">
                    <FiFilter className="empty-icon" />
                    <p>No matching requests found.</p>
                    <button
                        className="reset-filters"
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
        <div className="history-section">
            <div className="history-header">
                <h2><FiClock /> Request History</h2>
                <div className="history-search">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <FiX
                            className="clear-search"
                            onClick={() => setSearchTerm('')}
                            title="Clear search"
                        />
                    )}
                </div>
                <div className="method-filters">
                    {['get', 'post', 'put', 'delete', 'patch'].map(method => (
                        <button
                            key={method}
                            className={`filter-btn method-${method} ${activeFilter === method ? 'active' : ''}`}
                            onClick={() => handleFilterClick(method)}
                            title={`Filter ${method.toUpperCase()} requests`}
                        >
                            {method.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="history-content">
                {/* Today's requests */}
                {groupedHistory.today.length > 0 && (
                    <div className="history-group">
                        <h3 className="group-header">Today</h3>
                        <ul className="history-list">
                            {groupedHistory.today.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* Yesterday's requests */}
                {groupedHistory.yesterday.length > 0 && (
                    <div className="history-group">
                        <h3 className="group-header">Yesterday</h3>
                        <ul className="history-list">
                            {groupedHistory.yesterday.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* This week's requests */}
                {groupedHistory.thisWeek.length > 0 && (
                    <div className="history-group">
                        <h3 className="group-header">Earlier this week</h3>
                        <ul className="history-list">
                            {groupedHistory.thisWeek.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* This month's requests */}
                {groupedHistory.thisMonth.length > 0 && (
                    <div className="history-group">
                        <h3 className="group-header">Earlier this month</h3>
                        <ul className="history-list">
                            {groupedHistory.thisMonth.map(entry => renderHistoryItem(entry))}
                        </ul>
                    </div>
                )}

                {/* Older requests */}
                {groupedHistory.older.length > 0 && (
                    <div className="history-group">
                        <h3 className="group-header">Older</h3>
                        <ul className="history-list">
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
                className={`history-item ${selectedId === entry._id ? 'active' : ''}`}
                onClick={() => onSelectHistory(entry)}
                title={`View details for ${entry.method} ${urlTip}`}
            >
                <div className="history-item-header">
                    <span className={`method-badge method-${entry.method?.toLowerCase()}`}>
                        {entry.method}
                    </span>
                    <span className="history-url" title={urlTip}>{shortUrl || '/'}</span>
                </div>
                <div className="history-item-details">
                    <span className={`status-badge status-${String(entry.responseStatus || 0).charAt(0)}xx`}>
                        {entry.responseStatus || 'N/A'}
                    </span>

                    {/* Test Results Badge */}
                    {testResults && (
                        <span className={`test-badge ${testResults.passed === testResults.total ? 'test-passed' : 'test-failed'}`}
                            title={`Tests: ${testResults.passed}/${testResults.total} passed`}>
                            {testResults.passed}/{testResults.total} tests
                        </span>
                    )}

                    <span className="history-time">{formatTimeOnly(entry.timestamp)}</span>
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