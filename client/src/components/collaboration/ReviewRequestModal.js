import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import './ReviewRequestModal.css';

const ReviewRequestModal = ({ isOpen, onClose, resourceId, resourceType, resourceName }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedReviewers, setSelectedReviewers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(`Review for ${resourceName || resourceType}`);
            setDescription('');
            setSelectedReviewers([]);
            fetchTeamMembers();
        }
    }, [isOpen, resourceName, resourceType]);

    const fetchTeamMembers = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            let currentUser = null;
            if (storedUser) {
                try {
                    currentUser = JSON.parse(storedUser);
                } catch (e) { console.error('Error parsing user from local storage', e); }
            }

            let members = [];

            const res = await fetch('/api/auth/users/list', { credentials: 'include' });
            if (res.ok) {
                const users = await res.json();
                members = users;
            } else {
                const teamRes = await fetch('/api/teams', { credentials: 'include' });
                if (teamRes.ok) {
                    const teams = await teamRes.json();
                    const allMembers = new Map();
                    teams.forEach(t => {
                        t.members.forEach(m => {
                            if (m.userId) allMembers.set(m.userId._id, m.userId);
                        });
                        if (t.ownerId) allMembers.set(t.ownerId._id, t.ownerId);
                    });
                    members = Array.from(allMembers.values());
                }
            }

            if (currentUser && currentUser.id) {
                const alreadyExists = members.some(m => m._id === currentUser.id);
                if (!alreadyExists) {
                    members.push({
                        _id: currentUser.id,
                        displayName: `${currentUser.displayName || 'Me'} (Self)`,
                        email: currentUser.email
                    });
                } else {
                    members = members.map(m => m._id === currentUser.id ? { ...m, displayName: `${m.displayName} (Self)` } : m);
                }
            }

            setTeamMembers(members);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    resourceId,
                    resourceType,
                    title,
                    description,
                    reviewers: selectedReviewers
                })
            });

            if (res.ok) {
                onClose();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || 'Failed to send review request');
            }
        } catch (err) {
            console.error(err);
            alert('Error sending review request');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="rrm-overlay" onClick={onClose}>
            <div className="rrm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="rrm-header">
                    <h3 className="rrm-title">Request Review</h3>
                    <p className="rrm-subtitle">Invite team members to review this resource.</p>
                </div>

                <div className="rrm-body">
                    <form onSubmit={handleSubmit} className="rrm-form">
                        <div className="rrm-field">
                            <label className="rrm-label">Title</label>
                            <input
                                className="rrm-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="Review title"
                            />
                        </div>

                        <div className="rrm-field">
                            <label className="rrm-label">Description</label>
                            <textarea
                                className="rrm-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what needs to be reviewed..."
                            />
                        </div>

                        <div className="rrm-field">
                            <label className="rrm-label">Reviewers</label>
                            <div className="rrm-reviewer-list">
                                {teamMembers.map((user) => {
                                    const checked = selectedReviewers.includes(user._id);
                                    return (
                                        <label key={user._id} className="rrm-reviewer-row">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    setSelectedReviewers((prev) =>
                                                        e.target.checked
                                                            ? [...prev, user._id]
                                                            : prev.filter((id) => id !== user._id)
                                                    );
                                                }}
                                            />
                                            {user.displayName || user.email}
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="rrm-hint">Select one or more reviewers.</p>
                        </div>

                        <div className="rrm-footer">
                            <button
                                type="button"
                                className="rrm-btn rrm-btn--secondary"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rrm-btn rrm-btn--primary"
                                disabled={loading || selectedReviewers.length === 0}
                            >
                                {loading ? (
                                    <>
                                        <span className="rrm-spinner"></span>
                                        Sending…
                                    </>
                                ) : 'Send Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ReviewRequestModal;
