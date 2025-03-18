// client/src/components/SpotlightSection.js
import React from 'react';
import './SpotlightSection.css';

const SpotlightSection = () => {
    // Placeholder data for example requests
    const exampleRequests = [
        { id: '1', name: 'Example GET Request', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' },
        { id: '2', name: 'Example POST Request', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST', body: JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }) },
    ];

    //In real, scenario, it will fetch from database.

    const handleCloneRequest = (request) => {
        // Implement logic to create a new request based on the selected example
        alert(`Cloning request: ${request.name}`); // Replace with actual cloning logic
        // You would typically send a request to your backend to create a *copy* of the request
        // and then navigate the user to the edit page for the new request.
    };

    return (
        <div className="spotlight-section">
            <h2>Spotlight: Example Requests</h2>
            <ul>
                {exampleRequests.map((request) => (
                    <li key={request.id} className="spotlight-item">
                        <span>{request.name} ({request.method})</span>
                        <button onClick={() => handleCloneRequest(request)}>Clone</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SpotlightSection;