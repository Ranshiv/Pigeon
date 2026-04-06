import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';

const InlineCommentThread = ({ resourceId, resourceType, jsonPath, onClose }) => {
    // Styling for a popover or inline expansion
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    // context could provide user info

    useEffect(() => {
        if (resourceId) fetchComments();
    }, [resourceId, jsonPath]);

    const fetchComments = async () => {
        try {
            // Need an endpoint that supports filtering by jsonPath 
            // Current GET /api/comments/:type/:id gets ALL. Client side filter for now?
            // Or update API to accept query param
            console.log('Fetching comments for:', resourceType, resourceId);
            const res = await fetch(`/api/comments/${resourceType}/${resourceId}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const allComments = await res.json();
                console.log('Fetched comments:', allComments);
                const relevant = jsonPath
                    ? allComments.filter(c => c.jsonPath === jsonPath)
                    : allComments; // If no jsonPath specified, show all
                setComments(relevant);
            } else {
                console.error('Failed to fetch comments, status:', res.status);
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    };

    const handlePost = async () => {
        if (!newComment.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    resourceId,
                    resourceType,
                    jsonPath,
                    content: newComment
                })
            });
            if (res.ok) {
                const created = await res.json();
                console.log('Comment created:', created);
                setComments([...comments, created]);
                setNewComment('');
            } else {
                console.error('Failed to post comment, status:', res.status);
                alert('Failed to post comment');
            }
        } catch (err) {
            console.error('Error posting comment:', err);
            alert('Error posting comment: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id) => {
        try {
            const res = await fetch(`/api/comments/${id}/resolve`, {
                method: 'PATCH',
                credentials: 'include'
            });
            if (res.ok) {
                setComments(comments.map(c => c._id === id ? { ...c, resolved: true } : c));
            } else {
                console.error('Failed to resolve comment, status:', res.status);
                alert(`Failed to resolve comment. Status: ${res.status}`);
            }
        } catch (err) {
            console.error('Error resolving comment:', err);
            alert(`Error resolving comment: ${err.message}`);
        }
    };

    const handleUnresolve = async (id) => {
        try {
            const res = await fetch(`/api/comments/${id}/unresolve`, {
                method: 'PATCH',
                credentials: 'include'
            });
            if (res.ok) {
                setComments(comments.map(c => c._id === id ? { ...c, resolved: false } : c));
            } else {
                console.error('Failed to unresolve comment, status:', res.status);
                alert(`Failed to re-open comment. Status: ${res.status}. (Try restarting the backend server if this persists)`);
            }
        } catch (err) {
            console.error('Error unresolving comment:', err);
            alert(`Error unresolving comment: ${err.message}`);
        }
    };

    return (
        <div className="flex flex-col w-full h-full bg-[var(--card-bg)] rounded-lg overflow-hidden font-sans text-[var(--text-color)] shadow-xl border border-[var(--border-color)]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                <div>
                    <span className="font-semibold text-sm text-[var(--text-color)] block">Comments</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                        {resourceType}: {resourceId?.substring(0, 8)}...
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors rounded p-1 hover:bg-[var(--hover-bg)]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--background-color)]">
                {comments.length === 0 && (
                    <div className="text-center py-8 text-xs text-[var(--text-muted)] italic">
                        No comments yet. Be the first to start a discussion.
                    </div>
                )}

                {comments.map(comment => (
                    <div
                        key={comment._id}
                        className={`
                            rounded p-3 text-sm border transition-all
                            ${comment.resolved
                                ? 'bg-[var(--hover-bg)] border-[var(--border-color)] text-[var(--text-muted)] opacity-80'
                                : 'bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-color)] shadow-sm'}
                        `}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`font-semibold text-xs ${comment.resolved ? 'text-[var(--text-muted)]' : 'text-[var(--primary-color)]'}`}>
                                {comment.author?.displayName || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                {new Date(comment.createdAt).toLocaleDateString()}
                                {comment.resolved && <span className="text-[var(--success-color)] font-medium">Resolved</span>}
                            </span>
                        </div>

                        <div className="mb-2 leading-relaxed break-words">
                            {comment.content}
                        </div>

                        <div className="flex justify-end">
                            {comment.resolved ? (
                                <button
                                    onClick={() => handleUnresolve(comment._id)}
                                    className="text-[10px] font-medium text-[var(--warning-color)] hover:underline flex items-center gap-1 bg-[var(--hover-bg)] px-2 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--background-color)] transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
                                    Re-open
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleResolve(comment._id)}
                                    className="text-[10px] font-medium text-[var(--success-color)] hover:underline flex items-center gap-1 bg-[var(--hover-bg)] px-2 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--background-color)] transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Resolve
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
                <div className="flex gap-2">
                    <input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Type a comment..."
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handlePost();
                            }
                        }}
                        className="flex-1 bg-[var(--background-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] placeholder:text-[var(--text-muted)]"
                    />
                    <button
                        onClick={handlePost}
                        disabled={loading || !newComment.trim()}
                        className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white rounded p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InlineCommentThread;
