import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';

const ActivityFeed = ({ isOpen, onToggle }) => {
    const { socket } = useCollaboration();
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        fetchActivities();

        const handleNewActivity = (activity) => {
            setActivities(prev => [activity, ...prev]);
        };

        if (socket) {
            socket.on('activityLog', handleNewActivity);
        }
        return () => {
            if (socket) socket.off('activityLog', handleNewActivity);
        };
    }, [socket]);

    const fetchActivities = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/activities', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setActivities(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const timeAgo = (date) => {
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch (e) {
            return new Date(date).toLocaleTimeString();
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className={`
                    fixed top-[70px] z-[901] flex items-center gap-2 rounded-l-md border border-r-0 border-[var(--border-color)] bg-[var(--sidebar-bg)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-md transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--text-color)]
                    ${isOpen ? 'right-[280px]' : 'right-0'}
                `}
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span>Activity</span>
                    </>
                )}
            </button>

            {/* Sidebar Container */}
            <div
                className={`
                    fixed bottom-0 right-0 top-[60px] z-[900] w-[280px] transform overflow-y-auto border-l border-[var(--border-color)] bg-[var(--sidebar-bg)] shadow-2xl transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="flex items-center justify-between border-b border-[var(--border-color)] p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-color)]">Team Activity</h3>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hover-bg)] text-[10px] font-bold text-[var(--text-secondary)]">
                        {activities.length}
                    </div>
                </div>

                <div className="flex flex-col p-2">
                    {activities.length === 0 && (
                        <div className="py-8 text-center text-xs italic text-[var(--text-muted)]">
                            No recent activity
                        </div>
                    )}

                    {activities.map(act => (
                        <div key={act._id} className="group flex gap-3 border-b border-[var(--border-color)] p-3 last:border-0 hover:bg-[var(--hover-bg)] transition-colors rounded-md">
                            <div className="mt-1 h-2 w-2 flex-none rounded-full bg-[var(--primary-color)] ring-4 ring-[var(--primary-light)]"></div>

                            <div className="flex flex-col gap-1">
                                <p className="text-xs text-[var(--text-color)] leading-normal">
                                    <span className="font-semibold text-[var(--primary-color)] hover:underline cursor-pointer">
                                        {act.user?.displayName || 'User'}
                                    </span>
                                    {' '}
                                    <span className="text-[var(--text-secondary)]">
                                        {act.actionType?.toLowerCase().replace(/_/g, ' ')}
                                    </span>
                                    {' '}
                                    <span className="font-medium text-[var(--text-color)]">
                                        {act.resourceName}
                                    </span>
                                </p>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {timeAgo(act.createdAt)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ActivityFeed;
