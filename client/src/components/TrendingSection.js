//client/src/components/TrendingSection.js

import React from 'react';
import './TrendingSection.css'

const TrendingSection = () => {
    // Placeholder for recently used requests - In a real app, you'd store this
    // in local storage or in the user's profile on the backend.
    const recentRequests = [
        { id: 'recent-1', name: 'Recently Used 1', url: '/api/recent1', method: 'GET' },
        { id: 'recent-2', name: 'Recently Used 2', url: '/api/recent2', method: 'POST' },

    ];
    const handleRecentRequestClick = (request) => {
        // In a real application, you would navigate to the request details page
        alert(`Navigating to: ${request.name}`);
        // You'd likely use: navigate(`/requests/${request.id}`);  if you had stored the actual request IDs.
    };

    return (
        <div className="trending-section">
            <h2>Trending: Recently Used Requests</h2>
            <ul>
                {recentRequests.map(request => (
                    <li key={request.id} className="trending-item" onClick={() => handleRecentRequestClick(request)}>
                        {request.name}
                    </li>
                ))}
            </ul>

        </div>
    );
};

export default TrendingSection;