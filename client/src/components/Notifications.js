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
  const { socket } = useCollaboration();

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
      console.log('Received user activity:', data);
      if (!data || !data.activity) return;

      const { activity, userId, timestamp = new Date().toISOString() } = data;

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

    // Subscribe to the userActivity event
    socket.on('userActivity', handleUserActivity);

    // Clean up on unmount
    return () => {
      socket.off('userActivity', handleUserActivity);
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
                onClick={() => {
                  setUserActivities(prev =>
                    prev.map(activity => ({ ...activity, read: true }))
                  );
                  setUnreadCount(0);
                }}
              >
                Mark all as read
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