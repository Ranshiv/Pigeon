import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';
import { FiMessageSquare, FiCheckCircle, FiXCircle, FiFileText, FiActivity } from 'react-icons/fi';

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

    const getActivityIcon = (type) => {
        const actionType = type?.toLowerCase() || '';
        if (actionType.includes('approve')) return { icon: <FiCheckCircle size={12} />, bg: 'bg-emerald-500/10', color: 'text-emerald-500' };
        if (actionType.includes('reject')) return { icon: <FiXCircle size={12} />, bg: 'bg-rose-500/10', color: 'text-rose-500' };
        if (actionType.includes('comment')) return { icon: <FiMessageSquare size={12} />, bg: 'bg-amber-500/10', color: 'text-amber-500' };
        if (actionType.includes('request')) return { icon: <FiFileText size={12} />, bg: 'bg-[var(--primary-color)]/10', color: 'text-[var(--primary-color)]' };
        return { icon: <FiActivity size={12} />, bg: 'bg-slate-500/10', color: 'text-slate-500' };
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
                <div className="flex items-center justify-between p-5 pb-3">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-90">Team Activity</h3>
                    <div className="flex h-5 items-center justify-center rounded bg-[var(--primary-color)] px-1.5 text-[11px] font-bold text-white shadow-sm opacity-90">
                        {activities.length}
                    </div>
                </div>

                <div className="flex flex-col px-4 pb-6">
                    {activities.length === 0 && (
                        <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                            No recent activity
                        </div>
                    )}

                    {/* Timeline Container */}
                    <div className="relative mt-2">
                        {/* Vertical line */}
                        <div className="absolute left-[13px] top-4 bottom-4 w-px bg-[var(--border-color)]"></div>

                        {activities.map((act, idx) => {
                            const iconConfig = getActivityIcon(act.actionType);
                            const isLast = idx === activities.length - 1;

                            return (
                                <div key={act._id} className={`group relative flex gap-4 py-3 ${!isLast ? '' : ''}`}>
                                    {/* Icon container with solid background to break the line */}
                                    <div className="relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--sidebar-bg)]">
                                        <div className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${iconConfig.bg} ${iconConfig.color}`}>
                                            {iconConfig.icon}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5 pt-0.5">
                                        <p className="text-[13px] leading-[1.3] text-[var(--text-secondary)]">
                                            <span className="font-semibold text-[var(--text-color)]">
                                                {act.user?.displayName || 'User'}
                                            </span>
                                            {' '}
                                            <span className="opacity-80">
                                                {act.actionType?.toLowerCase().replace(/_/g, ' ')}
                                            </span>
                                            {' '}
                                            <span className="font-semibold text-[var(--text-color)]">
                                                {act.resourceName}
                                            </span>
                                        </p>
                                        <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                            {timeAgo(act.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ActivityFeed;
