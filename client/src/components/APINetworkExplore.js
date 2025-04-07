import React, { useState, useEffect } from 'react';
import './APINetworkExplore.css';
import { useNavigate } from 'react-router-dom';

const APINetworkExplore = () => {
    const navigate = useNavigate();
    const [recentRequests, setRecentRequests] = useState([]);

    // Placeholder data for example requests
    const exampleRequests = [
        { id: 'example-1', name: 'Example GET Request', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' },
        { id: 'example-2', name: 'Example POST Request', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST', body: JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }) },
    ];

    useEffect(() => {
        const fetchRecentHistory = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/history', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const historyData = await response.json();
                    // Take only the last 3 requests
                    const recentItems = historyData.slice(0, 3).map(item => ({
                        id: item._id,
                        name: `${item.method} ${new URL(item.url).pathname}`,
                        url: item.url,
                        method: item.method,
                        timestamp: new Date(item.timestamp).toLocaleDateString()
                    }));
                    setRecentRequests(recentItems);
                } else {
                    console.error('Failed to fetch history');
                }
            } catch (error) {
                console.error('Error fetching history:', error);
            }
        };

        fetchRecentHistory();
    }, []);

    const handleCreateRequestClick = () => {
        navigate('../requests/new');
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
                        </div>
                    ))}
                </div>
            </section>

            <section className="recent-requests">
                <h2>Recently Used Requests</h2>
                <div className="request-list">
                    {recentRequests.length > 0 ? (
                        recentRequests.map(request => (
                            <div key={request.id} className="request-item">
                                <h3>{request.name}</h3>
                                <p>
                                    <strong>URL:</strong> {request.url}
                                </p>
                                <p>
                                    <strong>Method:</strong> {request.method}
                                </p>
                                <p className="timestamp">
                                    <strong>Date:</strong> {request.timestamp}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p>No recent requests found</p>
                    )}
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