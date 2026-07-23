import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCollaboration } from '../../context/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';
import { FiMessageSquare, FiCheckCircle, FiXCircle, FiFileText, FiActivity, FiRefreshCw, FiSend, FiUser, FiUsers } from 'react-icons/fi';

const ActivityFeed = ({ isOpen, onToggle }) => {
    const { socket } = useCollaboration();
    const [activities, setActivities] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [scope, setScope] = useState('team'); // 'me' | 'team'
    const [toggleTop, setToggleTop] = useState(70);
    const [isDraggingToggle, setIsDraggingToggle] = useState(false);
    const toggleDragRef = useRef({ pointerId: null, startY: 0, startTop: 70, didDrag: false });
    const toggleTopRef = useRef(70);
    const activityRequestRef = useRef(0);

    const fetchActivities = useCallback(async () => {
        const requestId = ++activityRequestRef.current;
        try {
            const res = await fetch(`/api/activities?scope=${scope}`, {
                credentials: 'include',
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                if (requestId === activityRequestRef.current) {
                    setActivities(Array.isArray(data) ? data : []);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, [scope]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities, scope]);

    useEffect(() => {
        if (!socket) return;

        // The server broadcasts a lightweight workspace event. Refetching preserves
        // the active scope and workspace grouping instead of mixing activities locally.
        socket.on('userActivity', fetchActivities);
        return () => {
            socket.off('userActivity', fetchActivities);
        };
    }, [socket, fetchActivities]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchActivities();
        setTimeout(() => setRefreshing(false), 300);
    };

    const handleScopeChange = (nextScope) => {
        if (nextScope === scope) return;

        // Immediately hide the old scope and invalidate any in-flight response.
        // Without this, a slower My Activity request could overwrite Team activity.
        activityRequestRef.current += 1;
        setActivities([]);
        setScope(nextScope);
    };

    const handleTogglePointerDown = (event) => {
        if (isOpen) return;

        toggleDragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startTop: toggleTop,
            didDrag: false
        };
        toggleTopRef.current = toggleTop;
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDraggingToggle(true);
    };

    const handleTogglePointerMove = (event) => {
        const drag = toggleDragRef.current;
        if (drag.pointerId !== event.pointerId) return;

        const distance = event.clientY - drag.startY;
        if (Math.abs(distance) > 4) drag.didDrag = true;

        const minTop = 70;
        const maxTop = Math.max(minTop, window.innerHeight - 56);
        const nextTop = Math.round(Math.min(maxTop, Math.max(minTop, drag.startTop + distance)));
        toggleTopRef.current = nextTop;
        event.currentTarget.style.transform = `translate3d(0, ${nextTop - minTop}px, 0)`;
    };

    const handleTogglePointerEnd = (event) => {
        if (toggleDragRef.current.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        toggleDragRef.current.pointerId = null;
        setIsDraggingToggle(false);
        setToggleTop(toggleTopRef.current);
    };

    const handleToggleClick = () => {
        if (toggleDragRef.current.didDrag) {
            toggleDragRef.current.didDrag = false;
            return;
        }
        onToggle();
    };

    const timeAgo = (date) => {
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch (e) {
            return new Date(date).toLocaleTimeString();
        }
    };

    const getActivityLink = (act) => {
        if (!act) return null;
        if (act.resourceType === 'review') {
            return act.workspaceId ? `/workspace/workspaces/${act.workspaceId}?tab=reviews` : null;
        }
        if (act.resourceType === 'collection' && act.resourceId) {
            return `/workspace/collections/${act.resourceId}`;
        }
        if (act.resourceType === 'request' && act.resourceId) {
            return `/workspace/api-network/requests/${act.resourceId}`;
        }
        return null;
    };

    const getActivityIcon = (type) => {
        const actionType = type?.toLowerCase() || '';
        if (actionType.includes('approve')) return { icon: <FiCheckCircle size={12} />, bg: 'bg-emerald-500/10', color: 'text-emerald-500' };
        if (actionType.includes('reject')) return { icon: <FiXCircle size={12} />, bg: 'bg-rose-500/10', color: 'text-rose-500' };
        if (actionType.includes('comment')) return { icon: <FiMessageSquare size={12} />, bg: 'bg-amber-500/10', color: 'text-amber-500' };
        if (actionType.includes('request')) return { icon: <FiFileText size={12} />, bg: 'bg-[var(--primary-color)]/10', color: 'text-[var(--primary-color)]' };
        if (actionType.includes('api_test') || actionType.includes('test')) return { icon: <FiSend size={12} />, bg: 'bg-blue-500/10', color: 'text-blue-500' };
        return { icon: <FiActivity size={12} />, bg: 'bg-slate-500/10', color: 'text-slate-500' };
    };

    const activityGroups = useMemo(() => {
        if (scope === 'me') {
            return [{ id: 'me', name: 'My Activity', activities }];
        }

        const groups = new Map();
        activities.forEach((activity) => {
            const workspace = activity.workspace || {};
            const id = workspace.id || activity.workspaceId || 'unknown';
            if (!groups.has(id)) {
                groups.set(id, {
                    id,
                    name: workspace.name || 'Unnamed workspace',
                    category: workspace.category || 'team',
                    activities: []
                });
            }
            groups.get(id).activities.push(activity);
        });

        return Array.from(groups.values());
    }, [activities, scope]);

    return (
        <>
            {/* Toggle Button */}
            <button
                type="button"
                onClick={handleToggleClick}
                onPointerDown={handleTogglePointerDown}
                onPointerMove={handleTogglePointerMove}
                onPointerUp={handleTogglePointerEnd}
                onPointerCancel={handleTogglePointerEnd}
                style={isOpen ? undefined : {
                    transform: `translate3d(0, ${toggleTop - 70}px, 0)`,
                    willChange: isDraggingToggle ? 'transform' : 'auto'
                }}
                className={`
                    fixed top-[70px] z-[901] flex touch-none select-none items-center gap-2 rounded-l-md border border-r-0 border-[var(--border-color)] bg-[var(--sidebar-bg)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-md hover:bg-[var(--hover-bg)] hover:text-[var(--text-color)]
                    ${isOpen ? 'right-[280px] transition-all duration-300' : `right-0 ${isDraggingToggle ? 'cursor-grabbing transition-none' : 'cursor-grab transition-[transform,background-color,color] duration-200'}`}
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
                <div className="p-5 pb-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-90">{scope === 'me' ? 'My Activity' : 'Team Activity'}</h3>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleRefresh}
                                title="Refresh activity"
                                aria-label="Refresh activity"
                                className={`flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] shadow-sm transition-all hover:border-[var(--primary-color)]/40 hover:bg-[var(--hover-bg)] hover:text-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-1 focus:ring-offset-[var(--sidebar-bg)] ${refreshing ? 'cursor-wait' : ''}`}
                            >
                                <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                            </button>
                            <div
                                title={`${activities.length} activities`}
                                className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-[var(--primary-color)]/25 bg-[var(--primary-color)]/10 px-1.5 text-[11px] font-bold tabular-nums text-[var(--primary-color)]"
                            >
                                <FiActivity size={12} aria-hidden="true" />
                                <span>{activities.length}</span>
                                <span className="sr-only">activities</span>
                            </div>
                        </div>
                    </div>

                    {/* Scope selector */}
                    <div
                        role="tablist"
                        aria-label="Activity scope"
                        className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] p-1 shadow-inner"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={scope === 'me'}
                            onClick={() => handleScopeChange('me')}
                            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-1 focus:ring-offset-[var(--sidebar-bg)] ${scope === 'me' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-color)]'}`}
                        >
                            <FiUser size={13} />
                            My Activity
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={scope === 'team'}
                            onClick={() => handleScopeChange('team')}
                            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-1 focus:ring-offset-[var(--sidebar-bg)] ${scope === 'team' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-color)]'}`}
                        >
                            <FiUsers size={13} />
                            Team
                        </button>
                    </div>
                </div>

                <div className="flex flex-col px-4 pb-6">
                    {activities.length === 0 && (
                        <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                            {scope === 'team' ? 'No team workspace activity yet' : 'No recent activity'}
                        </div>
                    )}

                    {activityGroups.map((group) => (
                        <section key={group.id} className="mt-4 first:mt-2">
                            {scope === 'team' && (
                                <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--card-bg)] px-2.5 py-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--primary-color)]/10 text-[var(--primary-color)]">
                                            <FiUsers size={13} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Workspace</span>
                                            <span className="block truncate text-xs font-semibold text-[var(--text-color)]" title={group.name}>{group.name}</span>
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-[var(--primary-color)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--primary-color)]">
                                        {group.category === 'team' ? 'Team' : group.category}
                                    </span>
                                </div>
                            )}

                            {/* Workspace-scoped timeline */}
                            <div className="relative">
                                <div className="absolute left-[13px] top-4 bottom-4 w-px bg-[var(--border-color)]"></div>

                                {group.activities.map((act) => {
                                    const iconConfig = getActivityIcon(act.actionType);
                                    const link = getActivityLink(act);
                                    const content = (
                                        <>
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
                                                    <span className={`font-semibold text-[var(--text-color)] ${link ? 'group-hover:underline group-hover:text-[var(--primary-color)]' : ''}`}>
                                                        {act.resourceName}
                                                    </span>
                                                </p>
                                                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                                    {timeAgo(act.createdAt)}
                                                </span>
                                            </div>
                                        </>
                                    );

                                    return link ? (
                                        <Link
                                            key={act._id}
                                            to={link}
                                            className="group relative flex cursor-pointer gap-4 py-3"
                                            title="Open related resource"
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div key={act._id} className="group relative flex gap-4 py-3">
                                            {content}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ActivityFeed;
