// client/src/components/Notifications.js
import React, { useState, useEffect, useRef } from 'react';
import { FiBell } from 'react-icons/fi';
import './Notifications.css';
import { useCollaboration } from '../context/CollaborationContext';

const Notifications = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const recentActivityRef = useRef(new Map());
  const currentUserIdRef = useRef(null);
  const monitorStatusRef = useRef(new Map());
  const { socket } = useCollaboration();

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

  // Load persisted activity history on mount (historical → shown as already read)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/activities?scope=team&limit=50', { credentials: 'include' });
        if (!res.ok) return;
        const logs = await res.json();
        if (cancelled || !Array.isArray(logs)) return;
        setUserActivities(prev => [
          ...prev,
          ...logs.map(l => ({
            id: l._id,
            type: 'log',
            details: {
              actionType: l.actionType,
              resourceName: l.resourceName,
              actorName: l.user?.displayName
            },
            timestamp: l.createdAt,
            read: true
          }))
        ].slice(0, 50));
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

      // Increase unread count
      setUnreadCount(prev => prev + 1);
    };

    // Monitoring emits monitor_update on EVERY poll — only notify on status transitions
    const handleMonitorUpdate = (data) => {
      if (!data || !data.monitorId) return;
      const status = data.currentStatus || data.status;
      const prev = monitorStatusRef.current.get(data.monitorId);
      monitorStatusRef.current.set(data.monitorId, status);
      if (prev === undefined || prev === status) return; // seed silently; skip non-transitions

      setUserActivities(prevActs => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'monitor_status',
          details: { monitorId: data.monitorId, status, responseTime: data.responseTime },
          timestamp: data.timestamp || new Date().toISOString(),
          read: false
        },
        ...prevActs
      ].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    };

    // Subscribe to the userActivity event
    socket.on('userActivity', handleUserActivity);
    socket.on('monitor_update', handleMonitorUpdate);

    // Clean up on unmount
    return () => {
      socket.off('userActivity', handleUserActivity);
      socket.off('monitor_update', handleMonitorUpdate);
    };
  }, [socket]);

  // Toggle notifications dropdown
  const toggleNotifications = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Mark all as read when opening notifications
      setUserActivities(prev =>
        prev.map(activity => ({ ...activity, read: true }))
      );
      setUnreadCount(0);
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
        return `Monitor is now ${activity.details?.status || 'updated'}`;
      case 'log':
        return `${activity.details?.actorName || 'Someone'} ${activity.details?.actionType || 'updated'} ${activity.details?.resourceName || ''}`.trim();
      default:
        return `${activity.type}: ${JSON.stringify(activity.details)}`;
    }
  };

  return (
    <div className="notifications-container" ref={notificationRef}>
      <div className="notification-icon-wrapper" onClick={toggleNotifications}>
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {userActivities.length > 0 && (
              <button
                className="mark-all-read-btn"
                disabled={unreadCount === 0}
                title={unreadCount === 0 ? 'All caught up' : 'Mark all as read'}
                onClick={() => {
                  setUserActivities(prev =>
                    prev.map(activity => ({ ...activity, read: true }))
                  );
                  setUnreadCount(0);
                }}
              >
                <span>Read all</span>
              </button>
            )}
          </div>

          <div className="notifications-list">
            {userActivities?.length > 0 ? (
              userActivities.map(activity => (
                <div
                  key={activity.id}
                  className={`notification-item ${!activity.read ? 'unread' : ''}`}
                >
                  <div className="notification-content">
                    <p>{getNotificationMessage(activity)}</p>
                    <span className="notification-time">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
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