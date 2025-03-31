// src/components/HistorySection.js
import React from 'react';
import PropTypes from 'prop-types'; // Optional: for prop validation
import './HistorySection.css';
import { FiClock } from 'react-icons/fi'; // Example icon

// Helper to format date/time nicely
const formatTimestamp = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString(); // Adjust locale/options as needed
    } catch (e) {
        return 'Invalid Date';
    }
};

const HistorySection = ({ history = [], onSelectHistory }) => { // Default history to empty array

    if (!Array.isArray(history)) {
        console.error("History prop is not an array:", history);
        return <div>Error loading history data.</div>; // Handle invalid prop
    }

    if (history.length === 0) {
        return (
            <div className="history-section empty">
                <h2><FiClock /> Request History</h2>
                <p>No history yet. Send some requests!</p>
            </div>
        );
    }

    return (
        <div className="history-section">
            <h2><FiClock /> Request History</h2>
            <ul className="history-list">
                {history.map((entry) => (
                    <li
                        key={entry._id}
                        className="history-item"
                        onClick={() => onSelectHistory(entry)} // Allow selecting an entry
                        title={`View details for ${entry.method} ${entry.url}`}
                    >
                        <span className={`method-badge method-${entry.method?.toLowerCase()}`}>{entry.method}</span>
                        <span className="history-url">{entry.url}</span>
                        <span className={`status-badge status-${String(entry.responseStatus).charAt(0)}xx`}>
                            {entry.responseStatus || 'N/A'}
                        </span>
                        <span className="history-time">{formatTimestamp(entry.timestamp)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// Optional: Add prop types for better development experience
HistorySection.propTypes = {
    history: PropTypes.arrayOf(PropTypes.shape({
        _id: PropTypes.string.isRequired,
        method: PropTypes.string,
        url: PropTypes.string,
        responseStatus: PropTypes.number,
        timestamp: PropTypes.string,
    })),
    onSelectHistory: PropTypes.func.isRequired, // Function to handle click
};

export default HistorySection;