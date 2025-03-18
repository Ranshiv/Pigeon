// client/src/components/ResponseDisplay.js
import React from 'react';
import './ResponseDisplay.css'

const ResponseDisplay = ({ response }) => {
    return (
        <div className="response-display">
            <h2>Response</h2>
            <p>
                <strong>Status:</strong> {response.status} {response.statusText}
            </p>
            <div>
                <strong>Headers:</strong>
                <pre>{JSON.stringify(response.headers, null, 2)}</pre>
            </div>
            <div>
                <strong>Body:</strong>
                <pre>{typeof response.body === 'object' ? JSON.stringify(response.body, null, 2) : response.body}</pre>
            </div>
        </div>
    );
};

export default ResponseDisplay;