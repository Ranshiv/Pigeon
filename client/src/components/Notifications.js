// client/src/components/Notifications.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiBell } from 'react-icons/fi';
import './Notifications.css';
import { useCollaboration } from '../context/CollaborationContext';

const Notifications = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const notificationRef = useRef(null);
  const recentActivityRef = useRef(new Map());
  const currentUserIdRef = useRef(null);
  const monitorStatusRef = useRef(new Map());
  const { socket } = useCollaboration();
  const unreadCount = useMemo(
    () => userActivities.reduce((count, activity) => count + (activity.read ? 0 : 1), 0),
    [userActivities]
  );

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // Normalize to string so self-activity suppression is robust to id-form drift
        // (server emits String(_id); localStorage may store id or _id). compare as strings.
        currentUserIdRef.current = String(user?.id || user?._id || '') || null;
      }
    } catch {
      currentUserIdRef.current = null;
    }
  }, []);

  // Load persisted account-wide notification history on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/notifications?limit=50', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.notifications)) return;
        setUserActivities(data.notifications);
      } catch {
        // history is best-effort; live socket events still work
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle clicking outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen for user activity events
  useEffect(() => {
    if (!socket) return;

    const handleUserActivity = (data) => {
      if (!data || !data.activity) return;

      const { activity, userId, timestamp = new Date().toISOString() } = data;

      // Ignore self-activity (common when a user has multiple tabs/sockets open).
      // Compare as strings: server emits String(_id), localStorage id may differ in form.
      if (currentUserIdRef.current && String(userId) === String(currentUserIdRef.current)) return;

      // Basic de-duplication / flood protection
      let detailsKey = '';
      try {
        detailsKey = activity?.details ? JSON.stringify(activity.details) : '';
      } catch {
        detailsKey = String(activity?.details);
      }
      const signature = `${userId}|${activity?.type}|${detailsKey}`;
      const now = Date.now();
      const last = recentActivityRef.current.get(signature) || 0;
      if (now - last < 1000) return;
      recentActivityRef.current.set(signature, now);

      // Add the new activity to our state
      setUserActivities(prev => {
        const newActivities = [
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            type: activity.type,
            details: activity.details,
            timestamp,
            read: false
          },
          ...prev
        ].slice(0, 50); // Keep only the latest 50 notifications

        return newActivities;
      });

    };

    // Monitoring emits monitor_update on EVERY poll — only notify on status transitions
    const handleMonitorUpdate = (data) => {
      if (!data || !data.monitorId) return;
      const status = data.currentStatus || data.status;
      const prev = monitorStatusRef.current.get(data.monitorId);
      monitorStatusRef.current.set(data.monitorId, status);
      // Seed healthy monitors quietly, but surface an already failing/degraded
      // monitor the first time this browser receives it.
      if ((prev === undefined && status === 'up') || prev === status) return;

      setUserActivities(prevActs => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'monitor_status',
          details: { monitorId: data.monitorId, monitorName: data.monitorName, status, responseTime: data.responseTime },
          timestamp: data.timestamp || new Date().toISOString(),
          read: false
        },
        ...prevActs
      ].slice(0, 50));
    };

    const handleAppNotification = (notification) => {
      if (!notification?.message) return;

      setUserActivities(prev => {
        if (notification.id && prev.some(item => item.id === notification.id)) return prev;
        return [{
          id: notification.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: notification.type || 'system', message: notification.message,
          severity: notification.severity || 'info', timestamp: notification.timestamp || new Date().toISOString(),
          read: Boolean(notification.read)
        }, ...prev].slice(0, 50);
      });
    };

    const handleNotificationRead = ({ id }) => setUserActivities(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
    const handleNotificationsReadAll = () => setUserActivities(prev => prev.map(item => ({ ...item, read: true })));

    // Subscribe to the userActivity event
    socket.on('userActivity', handleUserActivity);
    socket.on('monitor_update', handleMonitorUpdate);
    socket.on('appNotification', handleAppNotification);
    socket.on('notificationRead', handleNotificationRead);
    socket.on('notificationsReadAll', handleNotificationsReadAll);

    // Clean up on unmount
    return () => {
      socket.off('userActivity', handleUserActivity);
      socket.off('monitor_update', handleMonitorUpdate);
      socket.off('appNotification', handleAppNotification);
      socket.off('notificationRead', handleNotificationRead);
      socket.off('notificationsReadAll', handleNotificationsReadAll);
    };
  }, [socket]);

  const markAllRead = async () => {
    setUserActivities(prev => prev.map(activity => ({ ...activity, read: true })));
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const markRead = async (activityId) => {
    setUserActivities(prev => prev.map(activity => (
      activity.id === activityId ? { ...activity, read: true } : activity
    )));
    await fetch(`/api/notifications/${activityId}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
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
        return `${activity.details?.monitorName || 'Monitor'} is now ${activity.details?.status || 'updated'}`;
      case 'system':
        return activity.message || activity.details?.message || 'System notification';
      case 'log': {
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
        return `${activity.type}: ${JSON.stringify(activity.details)}`;
    }
  };

  return (
    <div className="notifications-container" ref={notificationRef}>
      <button
        type="button"
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

      {isOpen && (
        <div className="notifications-dropdown" id="notifications-dropdown" role="dialog" aria-label="Notifications">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {userActivities.length > 0 && (
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
          </div>

          <div className="notifications-list">
            {userActivities?.length > 0 ? (
              userActivities.map(activity => (
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
      )}
    </div>
  );
};

export default Notifications;
