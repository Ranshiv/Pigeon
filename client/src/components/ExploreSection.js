// client/src/components/ExploreSection.js (Previously RequestList.js)
import React from 'react';
import './ExploreSection.css'; // Update the CSS file import
// REMOVE: import { useNavigate } from 'react-router-dom'; // No longer needed

const ExploreSection = ({ requests, onSelect, onSend, onDelete, onEdit }) => {
    // REMOVE: const navigate = useNavigate();

    return (
        <div className="explore-section">
            <h2>Explore Requests</h2>
            <ul>
                {requests.map((request) => (
                    <li key={request._id} className="request-item">
                        <span onClick={() => onSelect(request)}>{request.name}</span>
                        <div className="button-group">
                            <button onClick={(e) => { e.stopPropagation(); onSend(request); }}>Send</button>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(request); }}>Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(request._id); }}>Delete</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ExploreSection;