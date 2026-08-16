// client/src/components/Notifications.js
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiBell, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './Notifications.css';
import { useCollaboration } from '../context/CollaborationContext';

const defaultNotificationPreferences = {
  inAppEnabled: true,
  workspaceActivity: true,
  mergeRequests: true,
  monitoring: true,
  systemFailures: true
};

const getActivityCategory = (activity = {}) => {
  if (activity.category) return activity.category;
  if (activity.type === 'monitor_status' || activity.type === 'monitor_update') return 'monitoring';
  if (['merge_created', 'merge_approved', 'merge_rejected', 'merge_rolled_back', 'merge_request'].includes(activity.type)) return 'mergeRequests';
  // Older workspace notifications were stored as generic `system` entries.
  if (activity.workspaceId && activity.type === 'system') return 'workspaceActivity';
  if (['system', 'api_failure', 'request_failed', 'invalid_request'].includes(activity.type)) return 'systemFailures';
  return 'workspaceActivity';
};

const isNotificationEnabled = (preferences, category) => (
  preferences.inAppEnabled !== false && preferences[category] !== false
);

const mergeNotificationEntries = (current, incoming) => {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => {
    if (entry?.id) byId.set(entry.id, entry);
  });
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 50);
};

const Notifications = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(defaultNotificationPreferences);
  const notificationRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 68, left: 8, width: 320, maxHeight: 380 });
  const notificationPreferencesRef = useRef(defaultNotificationPreferences);
  const notificationIdsRef = useRef(new Set());
  const { socket } = useCollaboration();
  const visibleActivities = useMemo(
    () => notificationPreferences.inAppEnabled === false
      ? []
      : userActivities.filter((activity) => isNotificationEnabled(notificationPreferences, getActivityCategory(activity))),
    [notificationPreferences, userActivities]
  );
  const unreadCount = useMemo(
    () => visibleActivities.reduce((count, activity) => count + (activity.read ? 0 : 1), 0),
    [visibleActivities]
  );

  const applyNotificationPreferences = useCallback((preferences) => {
    const next = { ...defaultNotificationPreferences, ...(preferences || {}) };
    notificationPreferencesRef.current = next;
    setNotificationPreferences(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.notificationPreferences) applyNotificationPreferences(user.notificationPreferences);
      }
    } catch {}

    const handlePreferencesUpdated = (event) => applyNotificationPreferences(event.detail);
    window.addEventListener('notification-preferences-updated', handlePreferencesUpdated);

    // Hydrate from the server as the app shell may have mounted before Settings.
    fetch('/api/auth/check', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data?.isAuthenticated || !data.user) return;
        applyNotificationPreferences(data.user.notificationPreferences);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.removeEventListener('notification-preferences-updated', handlePreferencesUpdated);
    };
  }, [applyNotificationPreferences]);

  // Load persisted account-wide notification history on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/notifications?limit=50', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.notifications)) return;
        notificationIdsRef.current = new Set([
          ...notificationIdsRef.current,
          ...data.notifications.map((notification) => notification.id).filter(Boolean)
        ]);
        setUserActivities((current) => mergeNotificationEntries(current, data.notifications));
      } catch {
        // history is best-effort; live socket events still work
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle clicking outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedBell = notificationRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);
      if (!clickedBell && !clickedDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // The bell may live inside the responsive drawer, which has a transform and
  // scroll clipping. Positioning the panel from the viewport lets it remain
  // visible in both the drawer and the desktop navbar.
  useLayoutEffect(() => {
    if (!isOpen || !notificationButtonRef.current) return undefined;

    const updatePosition = () => {
      const rect = notificationButtonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(320, viewportWidth - 16);
      const left = Math.max(8, Math.min(viewportWidth - width - 8, rect.right - width));
      const maxHeight = Math.min(380, viewportHeight - 16);
      const top = rect.bottom + 8 + maxHeight <= viewportHeight || rect.top < maxHeight + 8
        ? rect.bottom + 8
        : Math.max(8, rect.top - 8 - maxHeight);
      setDropdownPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // The bell only consumes durable appNotification events. userActivity and
  // monitor_update remain real-time collaboration/dashboard signals, not items
  // with a server-backed read state.
  useEffect(() => {
    if (!socket) return;

    const handleAppNotification = (notification) => {
      if (!notification?.id || !notification.message) return;
      const category = getActivityCategory(notification);
      if (!isNotificationEnabled(notificationPreferencesRef.current, category)) return;
      if (notificationIdsRef.current.has(notification.id)) return;

      const entry = {
        id: notification.id,
        type: notification.type || 'system',
        category,
        message: notification.message,
        severity: notification.severity || 'info',
        timestamp: notification.timestamp || new Date().toISOString(),
        read: Boolean(notification.read)
      };
      notificationIdsRef.current.add(entry.id);
      setUserActivities((current) => mergeNotificationEntries(current, [entry]));
      const method = entry.severity === 'error' ? 'error' : entry.severity === 'warning' ? 'warn' : 'info';
      toast[method](entry.message, { toastId: entry.id });
    };

    const handleNotificationRead = ({ id }) => setUserActivities(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
    const handleNotificationsReadAll = () => setUserActivities(prev => prev.map(item => ({ ...item, read: true })));

    socket.on('appNotification', handleAppNotification);
    socket.on('notificationRead', handleNotificationRead);
    socket.on('notificationsReadAll', handleNotificationsReadAll);

    // Clean up on unmount
    return () => {
      socket.off('appNotification', handleAppNotification);
      socket.off('notificationRead', handleNotificationRead);
      socket.off('notificationsReadAll', handleNotificationsReadAll);
    };
  }, [socket]);

  const markAllRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to mark notifications as read.');
      setUserActivities((current) => current.map((activity) => ({ ...activity, read: true })));
    } catch (error) {
      toast.error(error.message || 'Unable to mark notifications as read.');
    }
  };

  const markRead = async (activityId) => {
    try {
      const response = await fetch(`/api/notifications/${activityId}/read`, { method: 'PATCH', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to mark notification as read.');
      setUserActivities((current) => current.map((activity) => (
        activity.id === activityId ? { ...activity, read: true } : activity
      )));
    } catch (error) {
      toast.error(error.message || 'Unable to mark notification as read.');
    }
  };

  // Format the timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Invalid timestamp format:', timestamp);
      return '';
    }
  };

  // Generate notification message based on activity type
  const getNotificationMessage = (activity) => {
    if (!activity) return 'Unknown activity';

    const message = typeof activity.message === 'string' ? activity.message.trim() : '';
    const detailMessage = typeof activity.details?.message === 'string' ? activity.details.message.trim() : '';
    const fallbackMessage = message && message !== activity.type ? message : detailMessage;

    switch (activity.type) {
      case 'workspace_view':
        return `Viewed workspace: ${activity.details?.workspaceName || 'Unknown workspace'}`;
      case 'collection_edit':
        return `Edited collection: ${activity.details?.collectionName || 'Unknown collection'}`;
      case 'request_sent':
        return `Sent request to ${activity.details?.endpoint || 'an API'}`;
      case 'comment_added':
        return `Added a comment: "${activity.details?.comment?.substring(0, 30)}${activity.details?.comment?.length > 30 ? '...' : ''}"`;
      case 'review_requested':
        return `${activity.details?.requesterName || 'Someone'} requested your review on ${activity.details?.title || 'a review'}`;
      case 'monitor_status':
        return fallbackMessage || `${activity.details?.monitorName || 'Monitor'} is now ${activity.details?.status || 'updated'}`;
      case 'system':
        return fallbackMessage || 'System notification';
      case 'api_failure':
      case 'request_failed':
      case 'invalid_request':
        return fallbackMessage || `${activity.type === 'invalid_request' ? 'Invalid API request' : 'API request failed'}${activity.details?.endpoint ? `: ${activity.details.endpoint}` : ''}`;
      case 'log': {
        if (fallbackMessage) return fallbackMessage;
        const actionLabels = {
          create: 'created',
          update: 'updated',
          delete: 'deleted',
          review_request: 'requested a review for',
          review_approve: 'approved',
          review_reject: 'rejected',
          comment: 'commented on',
          api_test: 'ran',
          deploy: 'deployed'
        };
        const action = actionLabels[activity.details?.actionType] || activity.details?.actionType || 'updated';
        return `${activity.details?.actorName || 'Someone'} ${action} ${activity.details?.resourceName || ''}`.trim();
      }
      default:
        return fallbackMessage || (activity.type ? activity.type.replace(/[_-]/g, ' ') : 'Notification');
    }
  };

  return (
    <div className="notifications-container" ref={notificationRef}>
      <button
        type="button"
        ref={notificationButtonRef}
        className={`notification-icon-wrapper${unreadCount ? ' has-notifications' : ''}`}
        onClick={() => setIsOpen(open => !open)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-controls="notifications-dropdown"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span key={unreadCount} className="notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && createPortal(
        <>
          <button
            type="button"
            className="notifications-sheet-backdrop"
            aria-label="Close notifications"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dropdownRef}
            className="notifications-dropdown"
            id="notifications-dropdown"
            role="dialog"
            aria-label="Notifications"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight
            }}
          >
          <div className="notifications-sheet-handle" aria-hidden="true" />
          <div className="notifications-header">
            <div className="notifications-heading">
              <h3>Notifications</h3>
              {unreadCount > 0 && <span className="notifications-unread-count">{unreadCount} new</span>}
            </div>
            <div className="notifications-header-actions">
              {visibleActivities.length > 0 && (
                <button
                  type="button"
                  className="mark-all-read-btn"
                  disabled={unreadCount === 0}
                  title={unreadCount === 0 ? 'All caught up' : 'Mark all as read'}
                  onClick={markAllRead}
                >
                  Read all
                </button>
              )}
              <button type="button" className="notifications-close-btn" onClick={() => setIsOpen(false)} aria-label="Close notifications">
                <FiX />
              </button>
            </div>
          </div>

          <div className="notifications-list">
            {visibleActivities?.length > 0 ? (
              visibleActivities.map(activity => (
                <button
                  type="button"
                  key={activity.id}
                  className={`notification-item ${!activity.read ? 'unread' : ''}`}
                  onClick={() => markRead(activity.id)}
                  aria-label={`${getNotificationMessage(activity)}${activity.read ? '' : ', unread'}`}
                >
                  <div className="notification-content">
                    <p className="notification-message">{getNotificationMessage(activity)}</p>
                    <span className="notification-time">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="no-notifications">
                <p>No new notifications</p>
              </div>
            )}
          </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Notifications;
