// client/src/components/RequestWorkspace.js
import React, { useState } from 'react';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import './RequestWorkspace.css';

const RequestWorkspace = ({ initialRequest, onSave }) => {
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [requestId, setRequestId] = useState(initialRequest?._id || null);

    // Handle sending a request
    const handleSendRequest = async (requestData) => {
        setLoading(true);
        setError(null);

        try {
            // If we have an ID, use it to send the request
            if (requestData._id) {
                const res = await fetch(`/api/requests/${requestData._id}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                if (!res.ok) {
                    throw new Error(`Failed to send request: ${res.statusText}`);
                }

                const responseData = await res.json();
                setResponse(responseData);
                setRequestId(requestData._id);
            }
            // If no ID, create a new request first
            else {
                const saveRes = await fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData),
                    credentials: 'include'
                });

                if (!saveRes.ok) {
                    throw new Error(`Failed to save request: ${saveRes.statusText}`);
                }

                const savedRequest = await saveRes.json();

                // Now send the request using the newly saved ID
                const sendRes = await fetch(`/api/requests/${savedRequest._id}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                if (!sendRes.ok) {
                    throw new Error(`Failed to send request: ${sendRes.statusText}`);
                }

                const responseData = await sendRes.json();
                setResponse(responseData);
                setRequestId(savedRequest._id);

                // Update the form with the saved request ID
                if (onSave) {
                    onSave(savedRequest);
                }
            }
        } catch (err) {
            console.error('Error sending request:', err);
            setError(err.message || 'Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    // Handle saving a request without sending
    const handleSaveRequest = async (requestData) => {
        try {
            if (requestData._id) {
                // Update existing request
                const res = await fetch(`/api/requests/${requestData._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData),
                    credentials: 'include'
                });

                if (!res.ok) {
                    throw new Error('Failed to update request');
                }

                const updatedRequest = await res.json();
                setRequestId(updatedRequest._id);

                // Call parent onSave if available
                if (onSave) {
                    onSave(updatedRequest);
                }
            } else {
                // Create new request
                const res = await fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData),
                    credentials: 'include'
                });

                if (!res.ok) {
                    throw new Error('Failed to save request');
                }

                const savedRequest = await res.json();
                setRequestId(savedRequest._id);

                // Call parent onSave if available
                if (onSave) {
                    onSave(savedRequest);
                }
            }
        } catch (err) {
            console.error('Error saving request:', err);
            alert('Failed to save request: ' + err.message);
        }
    };

    // Custom ResponseDisplay that accepts direct response data
    const ResponseDisplayWithData = ({ requestId, directResponse, loading, error }) => {
        if (loading) {
            return (
                <div className="response-area loading">
                    <div className="response-header">
                        <div className="loading-spinner"></div>
                        <span>Loading response...</span>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="response-area error">
                    <div className="response-header">
                        <div className="response-status error">
                            <span>Error</span>
                        </div>
                    </div>
                    <div className="response-body error-body">
                        {error}
                    </div>
                </div>
            );
        }

        if (directResponse) {
            // Use the passed response data directly
            return <ResponseDisplay requestId={null} responseData={directResponse} />;
        }

        // Fall back to fetching by requestId
        return <ResponseDisplay requestId={requestId} />;
    };

    return (
        <div className="request-workspace-container">
            <RequestForm
                initialRequest={initialRequest}
                onSendRequest={handleSendRequest}
                onSave={handleSaveRequest}
            />
            <div className="response-container">
                <ResponseDisplayWithData
                    requestId={requestId}
                    directResponse={response}
                    loading={loading}
                    error={error}
                />
            </div>
        </div>
    );
};

export default RequestWorkspace;