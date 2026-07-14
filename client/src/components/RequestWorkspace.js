// client/src/components/RequestWorkspace.js
import React, { useState } from 'react';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import ReviewRequestModal from './collaboration/ReviewRequestModal';
import InlineCommentThread from './collaboration/InlineCommentThread';

const RequestWorkspace = ({ initialRequest, onSave, onSend }) => {
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [requestId, setRequestId] = useState(initialRequest?._id || null);

    // UI State for Collaboration
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showComments, setShowComments] = useState(false);

    // Handle sending a request
    const handleSendRequest = async (requestData) => {
        setLoading(true);
        setError(null);

        try {
            // Auto-save the current configuration before sending
            // This ensures the "Send" button also functions as an implicit "Save"
            if (requestData._id) {
                if (onSave) {
                    onSave(requestData);
                }

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

                // Trigger history refresh if callback exists
                if (onSend) {
                    onSend();
                }
            }
            // If no ID, create a new request first (this already persists it)
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

                // Trigger history refresh if callback exists
                if (onSend) {
                    onSend();
                }
            }
        } catch (err) {
            console.error('Error sending request:', err);
            setError(err.message || 'Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    // Handle saving a request
    const handleSaveRequest = (requestData) => {
        // Delegate persistence to the parent component (APINetworkSection)
        if (onSave) {
            onSave(requestData);
        }
    };

    // Custom ResponseDisplay that accepts direct response data
    const ResponseDisplayWithData = ({ requestId, directResponse, loading, error }) => {
        if (loading) {
            return (
                <div style={{ display: 'flex', height: '10rem', width: '100%', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <div style={{ height: '1.5rem', width: '1.5rem', borderRadius: '50%', borderWidth: '2px', borderStyle: 'solid', borderColor: 'var(--border-color)', borderTopColor: 'var(--primary-color)', animation: 'spin 0.8s linear infinite' }}></div>
                        <span style={{ fontSize: '0.875rem' }}>Loading response...</span>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color, #dc2626)', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Error</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--danger-color, #dc2626)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background-color)', position: 'relative' }}>
            {/* Collaboration Toolbar - Now integrated as a sleek header bar */}
            {requestId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '0.5rem 1rem' }}>
                    <button
                        onClick={() => setShowComments(!showComments)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--border-radius, 6px)',
                            fontSize: '0.875rem', fontWeight: 500, height: '2.25rem', padding: '0 1rem', cursor: 'pointer', transition: 'all 0.15s ease',
                            background: showComments ? 'var(--primary-color)' : 'transparent',
                            color: showComments ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${showComments ? 'var(--primary-color)' : 'var(--border-color)'}`
                        }}
                    >
                        <svg style={{ marginRight: '0.5rem', height: '1rem', width: '1rem' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Comments
                    </button>

                    <button
                        onClick={() => setShowReviewModal(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--border-radius, 6px)',
                            fontSize: '0.875rem', fontWeight: 500, height: '2.25rem', padding: '0 1rem', cursor: 'pointer', transition: 'all 0.15s ease',
                            background: 'var(--success-color, #16a34a)', color: '#fff', border: 'none'
                        }}
                    >
                        <svg style={{ marginRight: '0.5rem', height: '1rem', width: '1rem' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M9 15a2 2 0 0 1 2-2 2 2 0 0 0-2-2"></path><path d="M9 15v2"></path></svg>
                        Request Review
                    </button>
                </div>
            )}

            <div style={{ flex: 1, overflow: 'auto' }}>
                <RequestForm
                    initialRequest={initialRequest}
                    onSendRequest={handleSendRequest}
                    onSave={handleSaveRequest}
                />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', minHeight: '200px' }}>
                <ResponseDisplayWithData
                    requestId={requestId}
                    directResponse={response}
                    loading={loading}
                    error={error}
                />
            </div>

            <ReviewRequestModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                resourceId={requestId}
                resourceType="request"
                resourceName={initialRequest ? initialRequest.name : "New Request"}
            />

            {showComments && requestId && (
                <div style={{ position: 'absolute', right: '1rem', top: '4rem', zIndex: 50, width: '20rem', borderRadius: 'var(--border-radius-lg, 8px)', border: '1px solid var(--border-color)', background: 'var(--card-bg)', boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))' }}>
                    <InlineCommentThread
                        resourceId={requestId}
                        resourceType="request"
                        onClose={() => setShowComments(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default RequestWorkspace;