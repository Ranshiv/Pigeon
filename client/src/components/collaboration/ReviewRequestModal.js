import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';

const ReviewRequestModal = ({ isOpen, onClose, resourceId, resourceType, resourceName }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedReviewers, setSelectedReviewers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(`Review for ${resourceName || resourceType}`);
            // Fetch potential reviewers (team members)
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

            // Fetch ALL users for easier collaboration
            const res = await fetch('/api/auth/users/list', { credentials: 'include' });
            if (res.ok) {
                const users = await res.json();
                console.log('Fetched users:', users);
                members = users;
            } else {
                console.warn('Failed to fetch all users, falling back to teams');
                // Use existing teams endpoint
                const teamRes = await fetch('/api/teams', { credentials: 'include' });
                if (teamRes.ok) {
                    const teams = await teamRes.json();
                    // Flatten all members from all teams
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

            // Ensure current user is in the list (for testing/self-review)
            if (currentUser && currentUser.id) {
                const alreadyExists = members.some(m => m._id === currentUser.id);
                if (!alreadyExists) {
                    members.push({
                        _id: currentUser.id,
                        displayName: `${currentUser.displayName || 'Me'} (Self)`,
                        email: currentUser.email
                    });
                } else {
                    // Update display name for clarity
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
            const res = await fetch('http://localhost:5001/api/reviews', {
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
                // Maybe trigger a toast or context refresh
                alert('Review request sent!');
            } else {
                alert('Failed to send review request');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-200 p-0">

                {/* Header */}
                <div className="flex flex-col space-y-1.5 p-6 border-b border-slate-800 bg-slate-950">
                    <h3 className="font-semibold leading-none tracking-tight text-white text-lg">Request Review</h3>
                    <p className="text-sm text-slate-400">Invite team members to review this resource.</p>
                </div>

                {/* Content */}
                <div className="p-6 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-200">
                                Title
                            </label>
                            <input
                                className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                                placeholder="Review Title"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-200">
                                Description
                            </label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Describe what needs to be reviewed..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-200">
                                Reviewers
                            </label>
                            <select
                                className="flex h-24 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-slate-950"
                                multiple
                                value={selectedReviewers}
                                onChange={e => {
                                    const options = [...e.target.selectedOptions];
                                    const values = options.map(option => option.value);
                                    setSelectedReviewers(values);
                                }}
                            >
                                {teamMembers.map(user => (
                                    <option
                                        key={user._id}
                                        value={user._id}
                                        className="py-1 px-2 checked:bg-blue-900 checked:text-white hover:bg-slate-800"
                                    >
                                        {user.displayName || user.email}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[0.8rem] text-slate-500">
                                Hold Ctrl/Cmd to select multiple reviewers.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end space-x-2 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-slate-800 hover:bg-slate-800 hover:text-white h-10 py-2 px-4 bg-transparent text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4 shadow-sm"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
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
