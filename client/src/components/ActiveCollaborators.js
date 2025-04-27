// client/src/components/ActiveCollaborators.js
import React, { useEffect, useState, useCallback } from 'react';
import './ActiveCollaborators.css';
import { useCollaboration } from '../context/CollaborationContext';
import { FiUsers, FiMessageCircle } from 'react-icons/fi';
// Replacing BiMessageTyping with FiMessageCircle which is available in react-icons/fi

function ActiveCollaborators({ collectionId, workspaceId }) {
  const {
    getActiveUsers,
    joinCollection,
    joinWorkspace,
    leaveCollection,
    leaveWorkspace,
    connected,
    connectionError,
    isReconnecting,
    getTypingUsers,
    reconnect
  } = useCollaboration();

  const [activeUsers, setActiveUsers] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Update active users list from context
  const updateActiveUsers = useCallback(() => {
    if (roomId && connected) {
      const users = getActiveUsers(roomId);
      console.log('Updated active users for room', roomId, ':', users);
      setActiveUsers(users);

      // Also update typing users
      const typing = getTypingUsers(roomId);
      setTypingUsers(typing || []);
    } else {
      setActiveUsers([]);
      setTypingUsers([]);
    }
  }, [roomId, connected, getActiveUsers, getTypingUsers]);

  // Join appropriate room when component mounts
  useEffect(() => {
    let currentRoomId = null;

    // Determine which type of room to join based on provided props
    if (collectionId) {
      currentRoomId = collectionId;
      setRoomId(currentRoomId);

      if (connected) {
        console.log('Joining collection room:', collectionId);
        joinCollection(collectionId);
      }
    } else if (workspaceId) {
      currentRoomId = workspaceId;
      setRoomId(currentRoomId);

      if (connected) {
        console.log('Joining workspace room:', workspaceId);
        joinWorkspace(workspaceId);
      }
    }

    // Clean up function - leave room when component unmounts
    return () => {
      if (connected && currentRoomId) {
        if (collectionId) {
          console.log('Leaving collection room:', collectionId);
          leaveCollection(collectionId);
        } else if (workspaceId) {
          console.log('Leaving workspace room:', workspaceId);
          leaveWorkspace(workspaceId);
        }
      }
    };
  }, [collectionId, workspaceId, connected, joinCollection, joinWorkspace, leaveCollection, leaveWorkspace]);

  // Update active users when room changes, connection status changes, or getActiveUsers function changes
  useEffect(() => {
    updateActiveUsers();

    // Set up an interval to periodically refresh the list of active users
    const refreshInterval = setInterval(updateActiveUsers, 5000); // Refresh every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [roomId, connected, getActiveUsers, updateActiveUsers, getTypingUsers]);

  // Generate random colors for user avatars based on user ID
  const getInitialsColor = (id) => {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33F0', '#33FFF0', '#FFDB33', '#9E33FF'];
    // Create a more deterministic but still random-looking color selection
    const charSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = charSum % colors.length;
    return colors[index];
  };

  // Get user initials from email or name
  const getUserInitials = (user) => {
    if (!user) return '??';

    // If user has a name property, use that first
    if (user.name) {
      const nameParts = user.name.split(' ');
      if (nameParts.length > 1) {
        // Get initials from first and last name
        return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
      } else {
        // Just use first two letters of the name
        return user.name.slice(0, 2).toUpperCase();
      }
    }

    // Check if user has an email property
    if (user.email) {
      // Extract the first part of the email (before @)
      const emailPrefix = user.email.split('@')[0];
      // Return the first 2 letters of the email prefix
      return emailPrefix.slice(0, 2).toUpperCase();
    }

    // Last resort: use user ID
    return user.id.slice(0, 2).toUpperCase();
  };

  // Format time since user joined
  const getActiveTime = (joinedAt) => {
    if (!joinedAt) return '';

    const joinTime = new Date(joinedAt);
    const now = new Date();
    const diffMs = now - joinTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min';
    if (diffMins < 60) return `${diffMins} mins`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hr';
    return `${diffHours} hrs`;
  };

  // Handle reconnection attempts
  const handleReconnect = () => {
    reconnect();
  };

  // If there's a connection error, show reconnection UI
  if (connectionError) {
    return (
      <div className="active-collaborators">
        <div className="collaborators-header error">
          <span>Connection Lost</span>
        </div>
        <div className="connection-error">
          <p>{connectionError}</p>
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="reconnect-button"
          >
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        </div>
      </div>
    );
  }

  // If there are no active users, show a simplified UI
  if (!activeUsers || activeUsers.length === 0) {
    return (
      <div className="active-collaborators">
        <div className="collaborators-header">
          <FiUsers />
          <span>No Active Collaborators</span>
        </div>
      </div>
    );
  }

  return (
    <div className="active-collaborators">
      <div className="collaborators-header">
        <FiUsers />
        <span>{activeUsers.length} Active {activeUsers.length === 1 ? 'Collaborator' : 'Collaborators'}</span>
      </div>

      <div className="collaborators-list">
        {activeUsers.map((user) => (
          <div
            key={user.id}
            className="collaborator-item"
          >
            <div
              className="collaborator-avatar"
              style={{ backgroundColor: getInitialsColor(user.id) }}
              title={user.name || `User ${user.id.substring(0, 6)}`}
            >
              {getUserInitials(user)}
              <span className="active-indicator"></span>
              {/* Show typing indicator if user is typing */}
              {typingUsers.some(typingUser => typingUser.userId === user.id) && (
                <span className="typing-indicator">
                  <FiMessageCircle />
                </span>
              )}
            </div>
            <div className="collaborator-info">
              <div className="collaborator-name">{user.name || `User ${user.id.substring(0, 6)}`}</div>
              <div className="collaborator-time">{getActiveTime(user.joinedAt)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Show typing indicator message */}
      {typingUsers.length > 0 && (
        <div className="typing-message">
          <FiMessageCircle />
          {typingUsers.length === 1
            ? `${typingUsers[0].name} is typing...`
            : `${typingUsers.length} people are typing...`}
        </div>
      )}
    </div>
  );
}

export default ActiveCollaborators;