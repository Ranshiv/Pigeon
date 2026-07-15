import React, { useState, useEffect } from 'react';

const ReviewDashboard = () => {
    const [reviews, setReviews] = useState([]);
    const [filter, setFilter] = useState('assigned'); // 'assigned' or 'created'
    const [loading, setLoading] = useState(true);
    const [editingReview, setEditingReview] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reviews?type=${filter}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setReviews(data);
            }
        } catch (err) {
            console.error('Failed to fetch reviews', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (reviewId, status) => {
        try {
            const res = await fetch(`/api/reviews/${reviewId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                fetchReviews(); // Refresh list
            }
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleEdit = (review) => {
        setEditingReview(review._id);
        setEditTitle(review.title);
        setEditDescription(review.description || '');
    };

    const handleCancelEdit = () => {
        setEditingReview(null);
        setEditTitle('');
        setEditDescription('');
    };

    const handleSaveEdit = async (reviewId) => {
        try {
            const res = await fetch(`/api/reviews/${reviewId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: editTitle,
                    description: editDescription
                })
            });
            if (res.ok) {
                setEditingReview(null);
                setEditTitle('');
                setEditDescription('');
                fetchReviews(); // Refresh list
            } else {
                alert('Failed to update review');
            }
        } catch (err) {
            console.error('Failed to update review', err);
            alert('Error updating review');
        }
    };

    // Helper for status badge styles
    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'rejected':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            default:
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    return (
        <div className="min-h-full bg-slate-950 p-6 md:p-10 font-sans text-slate-100 animate-in fade-in duration-500">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Reviews</h2>
                    <p className="text-slate-400">Manage your review requests and feedback.</p>
                </div>

                {/* Tabs / Filter */}
                <div className="border-b border-slate-800">
                    <div className="flex space-x-6">
                        <button
                            onClick={() => setFilter('assigned')}
                            className={`pb-3 text-sm font-medium transition-colors relative ${filter === 'assigned'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Assigned to Me
                        </button>
                        <button
                            onClick={() => setFilter('created')}
                            className={`pb-3 text-sm font-medium transition-colors relative ${filter === 'created'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Created by Me
                        </button>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center items-center py-20 text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                        Loading reviews...
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                        <p className="text-slate-500">No reviews found.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {reviews.map(review => (
                            <div
                                key={review._id}
                                className="group relative bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-5 transition-all duration-200 shadow-sm"
                            >
                                <div className="flex flex-col gap-4">
                                    {/* Header Line */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-1">
                                            {editingReview === review._id ? (
                                                <input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="w-full bg-slate-950 border border-blue-500/50 rounded px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    placeholder="Review title"
                                                    autoFocus
                                                />
                                            ) : (
                                                <h3 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors">
                                                    {review.title}
                                                </h3>
                                            )}
                                        </div>
                                        <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide ${getStatusStyle(review.status)}`}>
                                            {review.status}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="relative">
                                        {editingReview === review._id ? (
                                            <textarea
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className="w-full min-h-[80px] bg-slate-950 border border-blue-500/50 rounded px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                placeholder="Add a description..."
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                                                {review.description || 'No description provided'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Footer / Meta */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 mt-2 border-t border-slate-800/50">
                                        <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:gap-4">
                                            <span>
                                                Requested by
                                                <span className="text-slate-300 font-medium ml-1">
                                                    {review.requester?.displayName || 'Unknown'}
                                                </span>
                                            </span>
                                            <span className="hidden sm:inline text-slate-700">•</span>
                                            <span>{new Date(review.createdAt).toLocaleDateString()}</span>

                                            {review.status !== 'open' && review.reviewers?.length > 0 && (
                                                <>
                                                    <span className="hidden sm:inline text-slate-700">•</span>
                                                    <span>
                                                        Reviewed by:
                                                        <span className="text-slate-300 ml-1">
                                                            {review.reviewers.map(r => r.user?.displayName || 'Unknown').join(', ')}
                                                        </span>
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {/* Edit Actions */}
                                            {filter === 'created' && (
                                                editingReview === review._id ? (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSaveEdit(review._id); }}
                                                            className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                                            className="px-3 py-1.5 rounded text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(review); }}
                                                        className="px-3 py-1.5 rounded text-xs font-medium border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                )
                                            )}

                                            {/* View Request */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const requestUrl = review.resourceType === 'collection'
                                                        ? `/workspace/collections/${review.resourceId}`
                                                        : `/workspace/api-network/requests/${review.resourceId}`;
                                                    window.location.href = requestUrl;
                                                }}
                                                className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
                                            >
                                                View Request
                                            </button>

                                            {/* Approve / Reject */}
                                            {filter === 'assigned' && review.status === 'open' && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(review._id, 'rejected'); }}
                                                        className="px-3 py-1.5 rounded text-xs font-medium border border-red-900/50 hover:bg-red-900/20 text-red-500 transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(review._id, 'approved'); }}
                                                        className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewDashboard;
