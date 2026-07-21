import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import AppSelect from '../common/AppSelect/AppSelect';
import './ReviewRequestModal.css';

const ReviewRequestModal = ({ isOpen, onClose, resourceId, resourceType, resourceName, workspaceId }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedReviewers, setSelectedReviewers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [availableRequests, setAvailableRequests] = useState([]);
    const [selectedRequestId, setSelectedRequestId] = useState(resourceId || '');
    const [selectedResourceType, setSelectedResourceType] = useState('request');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId || '');

    // No resourceId passed in means the caller wants the user to pick what's being reviewed.
    const needsResourcePicker = !resourceId;

    useEffect(() => {
        if (isOpen) {
            setTitle(resourceName ? `Review for ${resourceName}` : '');
            setDescription('');
            setSelectedReviewers([]);
            setSelectedRequestId(resourceId || '');
            setSelectedResourceType(resourceType || 'request');
            setSelectedWorkspaceId(workspaceId || '');
            if (needsResourcePicker) fetchAvailableRequests();
        }
    }, [isOpen, resourceName, resourceType, resourceId, workspaceId]);

    // Re-fetch reviewers whenever the effective workspace changes (including
    // after the user picks a resource in the picker, which resolves its workspace).
    useEffect(() => {
        if (isOpen) fetchTeamMembers();
    }, [isOpen, selectedWorkspaceId]);

    // Saved requests aren't tagged with a workspaceId at creation time, so the
    // picker shows all of the user's saved requests rather than filtering by
    // workspace (filtering here would always return empty).
    // Most saved work lives in Collections (requests are usually embedded there,
    // not saved standalone), so offer both as reviewable resources.
    const fetchAvailableRequests = async () => {
        try {
            const [reqRes, colRes] = await Promise.all([
                fetch('/api/requests', { credentials: 'include' }),
                fetch('/api/collections', { credentials: 'include' })
            ]);
            const requests = reqRes.ok ? await reqRes.json() : [];
            let collections = colRes.ok ? await colRes.json() : [];
            // Scope collections to the modal's workspace when known — otherwise a
            // collection from another workspace could be picked, whose members
            // don't overlap with the reviewer list shown (server would reject them).
            if (workspaceId) {
                collections = collections.filter(c => String(c.workspaceId) === String(workspaceId));
            }
            setAvailableRequests([
                ...requests.map(r => ({ _id: r._id, name: r.name, resourceType: 'request' })),
                ...collections.map(c => ({ _id: c._id, name: c.name, resourceType: 'collection', workspaceId: c.workspaceId }))
            ]);
        } catch (err) {
            console.error('Failed to fetch requests', err);
        }
    };

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

            const usersUrl = selectedWorkspaceId
                ? `/api/auth/users/list?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`
                : '/api/auth/users/list';
            const res = await fetch(usersUrl, { credentials: 'include' });
            if (res.ok) {
                members = await res.json();
            } else if (!selectedWorkspaceId) {
                // Only fall back to the broader team list when we have no workspace
                // to scope to at all — never as a workspace-scoped fallback, since
                // that would leak members from unrelated teams into this workspace's list.
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
                    resourceId: resourceId || selectedRequestId,
                    resourceType: resourceId ? resourceType : selectedResourceType,
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
                        {needsResourcePicker && (
                            <div className="rrm-field">
                                <label className="rrm-label">What needs review?</label>
                                <AppSelect
                                    value={selectedRequestId}
                                    onChange={(id) => {
                                        setSelectedRequestId(id);
                                        const req = availableRequests.find(r => r._id === id);
                                        if (req) {
                                            setTitle(`Review for ${req.name || 'Untitled'}`);
                                            setSelectedResourceType(req.resourceType);
                                        }
                                        setSelectedReviewers([]);
                                    }}
                                    options={availableRequests.map((req) => ({ value: req._id, label: req.name || 'Untitled' }))}
                                />
                            </div>
                        )}

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
                                disabled={loading || selectedReviewers.length === 0 || (needsResourcePicker && !selectedRequestId)}
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
