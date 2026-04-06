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
                <div className="flex h-40 w-full items-center justify-center border-t border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
                        <span className="text-sm">Loading response...</span>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="w-full border-t border-red-900/20 bg-red-950/10 p-4">
                    <div className="flex items-center gap-2 text-red-500 mb-2">
                        <span className="text-sm font-semibold">Error</span>
                    </div>
                    <div className="text-sm text-red-400 font-mono">
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
        <div className="flex flex-col h-full bg-slate-950 relative">
            {/* Collaboration Toolbar - Now integrated as a sleek header bar */}
            {requestId && (
                <div className="flex items-center justify-end gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2">
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className={`
                            inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors 
                            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 
                            h-9 px-4 py-2 shadow-sm
                            ${showComments
                                ? 'bg-slate-800 text-white hover:bg-slate-700'
                                : 'bg-transparent border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'}
                        `}
                    >
                        <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Comments
                    </button>

                    <button
                        onClick={() => setShowReviewModal(true)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-4 py-2 bg-emerald-600 text-white shadow hover:bg-emerald-500"
                    >
                        <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M9 15a2 2 0 0 1 2-2 2 2 0 0 0-2-2"></path><path d="M9 15v2"></path></svg>
                        Request Review
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-auto">
                <RequestForm
                    initialRequest={initialRequest}
                    onSendRequest={handleSendRequest}
                    onSave={handleSaveRequest}
                />
            </div>

            <div className="border-t border-slate-800 min-h-[200px]">
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
                <div className="absolute right-4 top-16 z-50 w-80 rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
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