// client/src/components/ActiveCollaborators.js
import React, { useEffect, useState, useCallback } from 'react';
import './ActiveCollaborators.css';
import { useCollaboration } from '../context/CollaborationContext';
import { FiUsers, FiMessageCircle } from 'react-icons/fi';

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
  const [expanded, setExpanded] = useState(false);

  // Update active users list from context
  const updateActiveUsers = useCallback(() => {
    if (roomId && connected) {
      const users = getActiveUsers(roomId);
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
        joinCollection(collectionId);
      }
    } else if (workspaceId) {
      currentRoomId = workspaceId;
      setRoomId(currentRoomId);

      if (connected) {
        joinWorkspace(workspaceId);
      }
    }

    // Clean up function - leave room when component unmounts
    return () => {
      if (connected && currentRoomId) {
        if (collectionId) {
          leaveCollection(collectionId);
        } else if (workspaceId) {
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
  }, [roomId, connected, updateActiveUsers]);

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
        // Just use first letter of the name
        return user.name[0].toUpperCase();
      }
    }

    // Check if user has an email property
    if (user.email) {
      // Return the first letter of the email prefix
      return user.email[0].toUpperCase();
    }

    // Last resort: use user ID
    return user.id[0].toUpperCase();
  };

  // Handle reconnection attempts
  const handleReconnect = () => {
    reconnect();
  };

  // Toggle expanded view
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // If there's a connection error, show a minimal error indicator
  if (connectionError) {
    return (
      <div className="active-collaborators-minimal">
        <div className="collaborators-connection-error" onClick={handleReconnect}>
          <FiUsers className="connection-error-icon" />
          <span className="error-dot"></span>
        </div>
      </div>
    );
  }

  // If there are no active users, show minimal UI
  if (!activeUsers || activeUsers.length === 0) {
    return (
      <div className="active-collaborators-minimal">
        <div className="collaborators-summary empty">
          <FiUsers />
        </div>
      </div>
    );
  }

  const maxAvatarsToShow = expanded ? activeUsers.length : 3;
  const hasMoreUsers = activeUsers.length > maxAvatarsToShow && !expanded;

  return (
    <div className={`active-collaborators-minimal ${expanded ? 'expanded' : ''}`}>
      {/* Minimal collaborator summary that always shows */}
      <div className="collaborators-summary" onClick={toggleExpanded}>
        <div className="avatar-stack">
          {activeUsers.slice(0, maxAvatarsToShow).map((user, index) => (
            <div
              key={user.id}
              className="mini-avatar"
              style={{
                backgroundColor: getInitialsColor(user.id),
                zIndex: 10 - index // Ensures proper stacking order
              }}
              title={user.name || user.email || `User ${user.id.substring(0, 6)}`}
            >
              {getUserInitials(user)}
            </div>
          ))}
          {hasMoreUsers && (
            <div className="mini-avatar more">
              +{activeUsers.length - maxAvatarsToShow}
            </div>
          )}
        </div>
      </div>

      {/* Expanded collaborator details that shows on click */}
      {expanded && (
        <div className="collaborator-details">
          <div className="collaborator-details-header">
            <FiUsers />
            <span>{activeUsers.length} Active {activeUsers.length === 1 ? 'User' : 'Users'}</span>
            <button className="close-button" onClick={toggleExpanded}>×</button>
          </div>
          <div className="collaborator-list">
            {activeUsers.map((user) => (
              <div key={user.id} className="collaborator-item-minimal">
                <div
                  className="collaborator-avatar-minimal"
                  style={{ backgroundColor: getInitialsColor(user.id) }}
                >
                  {getUserInitials(user)}
                  {typingUsers.some(typingUser => typingUser.userId === user.id) && (
                    <span className="typing-indicator-minimal"><FiMessageCircle /></span>
                  )}
                </div>
                <div className="collaborator-name-minimal">
                  {user.name || user.email || `User ${user.id.substring(0, 6)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typing indicator that shows at the bottom */}
      {!expanded && typingUsers.length > 0 && (
        <div className="typing-indicator-floating">
          <FiMessageCircle />
        </div>
      )}
    </div>
  );
}

export default ActiveCollaborators;