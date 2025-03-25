// client/src/components/APINetworkExplore.js (NEW)
import React from 'react';
import './APINetworkExplore.css';
import { useNavigate } from 'react-router-dom';

const APINetworkExplore = () => {
    const navigate = useNavigate();

    // Placeholder data for example requests
    const exampleRequests = [
        { id: 'example-1', name: 'Example GET Request', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' },
        { id: 'example-2', name: 'Example POST Request', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST', body: JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }) },
    ];

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
    const handleCreateRequestClick = () => {
        navigate('../requests/new'); // Corrected navigation
    };

    return (
        <div className="api-network-explore">
            <section className="hero-section">
                <h2>Create and Manage Your API Requests</h2>
                <p>
                    Get started with Pigeon by creating a new request or importing an
                    existing one.
                </p>
                <button className="create-request-button" onClick={handleCreateRequestClick}>
                    Create Request
                </button>
                {/* You could add an "Import" button here later */}
            </section>

            <section className="example-requests">
                <h2>Example Requests</h2>
                <div className="request-list">
                    {exampleRequests.map((request) => (
                        <div key={request.id} className="request-item">
                            <h3>{request.name}</h3>
                            <p>
                                <strong>URL:</strong> {request.url}
                            </p>
                            <p>
                                <strong>Method:</strong> {request.method}
                            </p>
                            {/* Add a "Clone" button or similar functionality */}
                        </div>
                    ))}
                </div>
            </section>

            <section className="recent-requests">
                <h2>Recently Used Requests</h2>
                <div className="request-list">
                    {recentRequests.map(request => (
                        <div key={request.id} className="request-item" onClick={() => handleRecentRequestClick(request)}>
                            <h3>{request.name}</h3>
                            <p>
                                <strong>URL:</strong> {request.url}
                            </p>
                            <p>
                                <strong>Method:</strong> {request.method}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="collections-placeholder">
                <h2>Collections</h2>
                <p>Organize your requests into collections (Coming Soon!)</p>
            </section>
        </div>
    );
};

export default APINetworkExplore;