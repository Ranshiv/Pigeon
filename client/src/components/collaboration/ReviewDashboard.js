import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FiCheckCircle, FiXCircle, FiEdit2, FiEye, FiPlus, FiClock, FiUser, FiCheckSquare } from 'react-icons/fi';
import ReviewRequestModal from './ReviewRequestModal';
import './ReviewDashboard.css';

const ReviewDashboard = () => {
    const [reviews, setReviews] = useState([]);
    const [filter, setFilter] = useState('assigned');
    const [loading, setLoading] = useState(true);
    const [editingReview, setEditingReview] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reviews?type=${filter}`, { credentials: 'include' });
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
            if (res.ok) fetchReviews();
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
                body: JSON.stringify({ title: editTitle, description: editDescription })
            });
            if (res.ok) {
                setEditingReview(null);
                setEditTitle('');
                setEditDescription('');
                fetchReviews();
            }
        } catch (err) {
            console.error('Failed to update review', err);
        }
    };

    const statusConfig = {
        approved: { label: 'Approved', icon: FiCheckCircle, class: 'status--approved' },
        rejected: { label: 'Rejected', icon: FiXCircle, class: 'status--rejected' },
        open: { label: 'Open', icon: FiClock, class: 'status--open' }
    };

    const stats = {
        total: reviews.length,
        open: reviews.filter(r => r.status === 'open').length,
        approved: reviews.filter(r => r.status === 'approved').length,
        rejected: reviews.filter(r => r.status === 'rejected').length
    };

    return (
        <div className="rd-shell">
            <div className="rd-container">
                <div className="rd-header">
                    <div className="rd-header__left">
                        <div className="rd-header__icon" aria-hidden="true"><FiCheckSquare /></div>
                        <div>
                            <h2 className="rd-title">Reviews</h2>
                            <p className="rd-subtitle">Request, manage, and respond to reviews.</p>
                        </div>
                    </div>
                    <button className="rd-btn rd-btn--primary" onClick={() => setShowCreateModal(true)}>
                        <FiPlus size={16} />
                        New Review
                    </button>
                </div>

                <div className="rd-stats">
                    <div className="rd-stat">
                        <span className="rd-stat__value">{stats.total}</span>
                        <span className="rd-stat__label">Total</span>
                    </div>
                    <div className="rd-stat">
                        <span className="rd-stat__value rd-stat__value--open">{stats.open}</span>
                        <span className="rd-stat__label">Open</span>
                    </div>
                    <div className="rd-stat">
                        <span className="rd-stat__value rd-stat__value--approved">{stats.approved}</span>
                        <span className="rd-stat__label">Approved</span>
                    </div>
                    <div className="rd-stat">
                        <span className="rd-stat__value rd-stat__value--rejected">{stats.rejected}</span>
                        <span className="rd-stat__label">Rejected</span>
                    </div>
                </div>

                <div className="rd-tabs">
                    <button
                        className={`rd-tab ${filter === 'assigned' ? 'rd-tab--active' : ''}`}
                        onClick={() => setFilter('assigned')}
                    >
                        Assigned to Me
                    </button>
                    <button
                        className={`rd-tab ${filter === 'created' ? 'rd-tab--active' : ''}`}
                        onClick={() => setFilter('created')}
                    >
                        Created by Me
                    </button>
                </div>

                <ReviewRequestModal
                    isOpen={showCreateModal}
                    onClose={() => { setShowCreateModal(false); fetchReviews(); }}
                    resourceId="new-review"
                    resourceType="review"
                    resourceName="New Review"
                />

                {loading ? (
                    <div className="rd-empty">
                        <div className="rd-spinner"></div>
                        <span>Loading reviews…</span>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="rd-empty rd-empty--boxed">
                        <p>No reviews found.</p>
                        <button className="rd-btn rd-btn--primary" onClick={() => setShowCreateModal(true)}>
                            Create your first review
                        </button>
                    </div>
                ) : (
                    <div className="rd-grid">
                        {reviews.map(review => {
                            const status = statusConfig[review.status] || statusConfig.open;
                            const StatusIcon = status.icon;
                            const isEditing = editingReview === review._id;

                            return (
                                <div key={review._id} className="rd-card">
                                    <div className="rd-card__header">
                                        <div className="rd-card__meta">
                                            {isEditing ? (
                                                <input
                                                    className="rd-input"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <h3 className="rd-card__title">{review.title}</h3>
                                            )}
                                            <span className={`rd-status ${status.class}`}>
                                                <StatusIcon size={12} />
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <textarea
                                            className="rd-textarea"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            rows={3}
                                        />
                                    ) : (
                                        <p className="rd-card__desc">
                                            {review.description || 'No description provided.'}
                                        </p>
                                    )}

                                    <div className="rd-card__footer">
                                        <div className="rd-card__info">
                                            <span className="rd-card__info-item">
                                                <FiUser size={12} />
                                                {review.requester?.displayName || 'Unknown'}
                                            </span>
                                            <span className="rd-card__info-item">
                                                <FiClock size={12} />
                                                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                            </span>
                                            {review.status !== 'open' && review.reviewers?.length > 0 && (
                                                <span className="rd-card__info-item">
                                                    {review.reviewers.map(r => r.user?.displayName).filter(Boolean).join(', ')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="rd-card__actions">
                                            {filter === 'created' && (
                                                isEditing ? (
                                                    <>
                                                        <button className="rd-btn rd-btn--success" onClick={() => handleSaveEdit(review._id)}>Save</button>
                                                        <button className="rd-btn rd-btn--ghost" onClick={handleCancelEdit}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <button className="rd-btn rd-btn--ghost" onClick={() => handleEdit(review)}>
                                                        <FiEdit2 size={14} />
                                                        Edit
                                                    </button>
                                                )
                                            )}

                                            <a
                                                href={review.resourceType === 'collection'
                                                    ? `/workspace/collections/${review.resourceId}`
                                                    : `/workspace/api-network/requests/${review.resourceId}`}
                                                className="rd-btn rd-btn--ghost"
                                            >
                                                <FiEye size={14} />
                                                View
                                            </a>

                                            {filter === 'assigned' && review.status === 'open' && (
                                                <>
                                                    <button
                                                        className="rd-btn rd-btn--danger"
                                                        onClick={() => handleStatusUpdate(review._id, 'rejected')}
                                                    >
                                                        <FiXCircle size={14} />
                                                        Reject
                                                    </button>
                                                    <button
                                                        className="rd-btn rd-btn--success"
                                                        onClick={() => handleStatusUpdate(review._id, 'approved')}
                                                    >
                                                        <FiCheckCircle size={14} />
                                                        Approve
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewDashboard;
