// client/src/context/CollaborationContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import VersionControlService from '../services/VersionControlService';

// Create the collaboration context
const CollaborationContext = createContext();

// Custom hook for using the collaboration context
export const useCollaboration = () => useContext(CollaborationContext);

// The Collaboration Provider component
export const CollaborationProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeRooms, setActiveRooms] = useState({});
  const [currentRoom, setCurrentRoom] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  // Add version control state
  const [documentVersions, setDocumentVersions] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});
  const [mergeConflicts, setMergeConflicts] = useState({});

  // Use a ref to track rooms for rejoining on reconnect
  const roomsRef = useRef(new Set());
  // Add ref for tracking currently edited documents
  const editingDocumentsRef = useRef(new Map());

  // Get user information from local storage or state
  const getUserInfo = useCallback(() => {
    // Try to get user info from localStorage if available
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          userId: user.id || user._id,
          name: user.displayName || user.username || user.name,
          email: user.email,
          avatar: user.profilePicture || user.avatar
        };
      }
    } catch (err) {
      console.error('Error getting user data from localStorage:', err);
    }

    // Return generic info if no user data found
    return {
      userId: `guest-${Math.random().toString(36).substring(2, 10)}`,
      name: 'Guest User'
    };
  }, []);

  // Initialize the socket connection
  useEffect(() => {
    // Connect to the server
    const socketInstance = io('http://localhost:5001', {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Set up event listeners
    socketInstance.on('connect', () => {
      // Reduce logging to prevent console spam
      setConnected(true);
      setConnectionError(null);
      setIsReconnecting(false);
      setReconnectAttempts(0);

      // Authenticate the socket connection with user data
      const userData = getUserInfo();
      socketInstance.emit('authenticate', {
        ...userData,
        rooms: Array.from(roomsRef.current) // Send rooms to rejoin if reconnecting
      }, (response) => {
        if (response && response.success) {
          // Rejoining rooms if we were in any
          if (roomsRef.current.size > 0) {
            // Silently rejoin without logging
          }
        } else {
          console.error('Socket authentication failed:', response?.message || 'Unknown error');
        }
      });
    });

    socketInstance.on('disconnect', (reason) => {
      // Reduce logging to prevent console spam
      setConnected(false);

      // Don't clear active rooms on disconnect - we'll try to rejoin on reconnect
      if (reason === 'io server disconnect') {
        // Server forced disconnect - need to manually reconnect
        socketInstance.connect();
      }
      // We'll keep the rooms in the ref for rejoining
    });

    socketInstance.on('reconnecting', (attemptNumber) => {
      // Only log after multiple attempts to reduce noise
      if (attemptNumber > 3) {
        console.log(`Socket reconnecting... Attempt ${attemptNumber}`);
      }
      setIsReconnecting(true);
      setReconnectAttempts(attemptNumber);
    });

    socketInstance.on('reconnect_failed', () => {
      // Keep error logging for important connection issues
      console.error('Socket reconnection failed');
      setConnectionError('Failed to reconnect to collaboration server');
      setIsReconnecting(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(`Connection error: ${error.message}`);
    });

    // Listen for user joined events (matches server's "userJoined" event)
    socketInstance.on('userJoined', ({ userId, user, timestamp }) => {
      if (!currentRoom) return;

      // Remove excessive logging that fills up the console
      setActiveRooms(prev => {
        const updatedRooms = { ...prev };
        if (!updatedRooms[currentRoom]) {
          updatedRooms[currentRoom] = [];
        }

        // Check if user already exists in the room
        if (!updatedRooms[currentRoom].some(existingUser => existingUser.id === userId)) {
          updatedRooms[currentRoom] = [...updatedRooms[currentRoom], {
            id: userId,
            joinedAt: timestamp,
            name: user?.name,
            email: user?.email,
            avatar: user?.avatar
          }];
        }

        return updatedRooms;
      });
    });

    // Listen for user left events (matches server's "userLeft" event)
    socketInstance.on('userLeft', ({ userId }) => {
      if (!currentRoom) return;

      // Remove excessive logging that fills up the console
      setActiveRooms(prev => {
        const updatedRooms = { ...prev };
        if (updatedRooms[currentRoom]) {
          updatedRooms[currentRoom] = updatedRooms[currentRoom].filter(user => user.id !== userId);
        }
        return updatedRooms;
      });

      // Also clear any typing indicators for this user
      setTypingUsers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(room => {
          updated[room] = updated[room].filter(user => user.userId !== userId);
        });
        return updated;
      });
    });

    // Listen for active users events (matches server's "activeUsers" event)
    socketInstance.on('activeUsers', ({ room, users }) => {
      // Remove excessive logging that fills up the console
      setActiveRooms(prev => ({
        ...prev,
        [room]: users.map(user => ({
          id: user.id || user,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          joinedAt: new Date()
        }))
      }));
    });

    // Listen for typing indicator events
    socketInstance.on('typingIndicator', ({ userId, user, isTyping, room }) => {
      // Remove excessive logging that fills up the console

      setTypingUsers(prev => {
        const updated = { ...prev };
        if (!updated[room]) {
          updated[room] = [];
        }

        if (isTyping) {
          // Add user to typing list if not already there
          if (!updated[room].some(u => u.userId === userId)) {
            updated[room].push({
              userId,
              name: user?.name || 'Anonymous',
              timestamp: new Date()
            });
          }
        } else {
          // Remove user from typing list
          updated[room] = updated[room].filter(u => u.userId !== userId);
        }

        return updated;
      });
    });

    // Listen for document version changed events
    socketInstance.on('documentVersionChanged', ({ entityType, entityId, userId, version, changes }) => {
      // Remove excessive logging that fills up the console

      // Update version in state
      setDocumentVersions(prev => ({
        ...prev,
        [`${entityType}:${entityId}`]: {
          ...prev[`${entityType}:${entityId}`],
          latestVersion: version
        }
      }));
    });

    // Listen for merge request events
    socketInstance.on('mergeRequestCreated', ({ mergeRequest }) => {
      // Remove excessive logging - handle UI notifications only
      // You can handle UI notifications here
    });

    // Listen for merge completion events
    socketInstance.on('mergeCompleted', ({ sourceId, targetId, success, conflicts }) => {
      // Only log failures and conflicts, not every merge operation
      if (!success && conflicts) {
        console.error('Merge conflicts detected:', conflicts);
        // Handle conflicts in the UI
      }
    });

    // Implement heartbeat to keep connection alive and verify active status
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected && currentRoom) {
        socketInstance.emit('heartbeat', { room: currentRoom });
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Clean up on unmount
    setSocket(socketInstance);

    return () => {
      console.log('Cleaning up socket connection');
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
    };
  }, []); // Remove currentRoom dependency to avoid recreating socket

  // Update current room separately
  useEffect(() => {
    if (currentRoom && socket) {
      // Send heartbeat for new room
      socket.emit('heartbeat', { room: currentRoom });
    }
  }, [currentRoom, socket]);

  // Join a collection room
  const joinCollection = useCallback((collectionId) => {
    if (socket && connected) {
      const roomName = `collection:${collectionId}`;
      setCurrentRoom(roomName);
      roomsRef.current.add(roomName); // Track room in ref
      console.log('Joining collection:', collectionId);
      socket.emit('joinCollection', collectionId);

      // Fetch version history for this collection
      loadVersionHistory('collection', collectionId);
    }
  }, [socket, connected]);

  // Leave a collection room
  const leaveCollection = useCallback((collectionId) => {
    if (socket && connected) {
      const roomName = `collection:${collectionId}`;
      roomsRef.current.delete(roomName); // Remove from tracked rooms
      console.log('Leaving collection:', collectionId);
      socket.emit('leaveCollection', collectionId);
      setCurrentRoom(prev => prev === roomName ? null : prev);

      // Clear editing state
      editingDocumentsRef.current.delete(`collection:${collectionId}`);
    }
  }, [socket, connected]);

  // Join a workspace room
  const joinWorkspace = useCallback((workspaceId) => {
    if (socket && connected) {
      const roomName = `workspace:${workspaceId}`;
      setCurrentRoom(roomName);
      roomsRef.current.add(roomName); // Track room in ref
      console.log('Joining workspace:', workspaceId);
      socket.emit('joinWorkspace', workspaceId);

      // Fetch version history for this workspace
      loadVersionHistory('workspace', workspaceId);
    }
  }, [socket, connected]);

  // Leave a workspace room
  const leaveWorkspace = useCallback((workspaceId) => {
    if (socket && connected) {
      const roomName = `workspace:${workspaceId}`;
      roomsRef.current.delete(roomName); // Remove from tracked rooms
      console.log('Leaving workspace:', workspaceId);
      socket.emit('leaveWorkspace', workspaceId);
      setCurrentRoom(prev => prev === roomName ? null : prev);

      // Clear editing state
      editingDocumentsRef.current.delete(`workspace:${workspaceId}`);
    }
  }, [socket, connected]);

  // Send activity to server
  const sendActivity = useCallback((activityType, details) => {
    if (socket && connected && currentRoom) {
      console.log('Sending activity:', activityType, 'in room:', currentRoom);
      socket.emit('userActivity', {
        room: currentRoom,
        activity: {
          type: activityType,
          details
        }
      });
    }
  }, [socket, connected, currentRoom]);

  // Load version history for an entity
  const loadVersionHistory = useCallback(async (entityType, entityId) => {
    try {
      const history = await VersionControlService.getVersionHistory(entityType, entityId);
      setDocumentVersions(prev => ({
        ...prev,
        [`${entityType}:${entityId}`]: history
      }));
      return history;
    } catch (error) {
      console.error(`Error loading version history for ${entityType}:${entityId}`, error);
      return [];
    }
  }, []);

  // Start editing a document - track changes locally first
  const startEditing = useCallback((entityType, entityId, initialContent) => {
    const docKey = `${entityType}:${entityId}`;
    editingDocumentsRef.current.set(docKey, {
      originalContent: initialContent,
      lastSaved: initialContent,
      editStartTime: new Date()
    });

    // Let others know someone is editing
    if (socket && connected) {
      const roomName = `${entityType}:${entityId}`;
      socket.emit('documentEditStarted', {
        room: currentRoom,
        entityType,
        entityId
      });
    }

    return () => stopEditing(entityType, entityId); // Return cleanup function
  }, [socket, connected, currentRoom]);

  // Track changes to a document
  const trackChanges = useCallback((entityType, entityId, newContent) => {
    const docKey = `${entityType}:${entityId}`;
    const editingInfo = editingDocumentsRef.current.get(docKey);

    if (editingInfo) {
      // Generate diff from last saved content
      const changes = VersionControlService.generateDiff(
        editingInfo.lastSaved,
        newContent
      );

      // Store pending changes
      setPendingChanges(prev => ({
        ...prev,
        [docKey]: {
          originalContent: editingInfo.originalContent,
          changes,
          updatedContent: newContent,
          timestamp: new Date()
        }
      }));
    }
  }, []);

  // Stop editing and save changes
  const stopEditing = useCallback(async (entityType, entityId, saveChanges = true, commitMessage = '') => {
    const docKey = `${entityType}:${entityId}`;
    const editingInfo = editingDocumentsRef.current.get(docKey);
    const pendingChange = pendingChanges[docKey];

    if (!editingInfo || !pendingChange) {
      return;
    }

    if (saveChanges) {
      try {
        const userData = getUserInfo();
        const savedVersion = await VersionControlService.saveVersion(
          entityType,
          entityId,
          pendingChange.changes,
          userData.userId,
          commitMessage || 'Updated document'
        );

        // Broadcast version change to others
        if (socket && connected) {
          socket.emit('documentVersionChanged', {
            room: currentRoom,
            entityType,
            entityId,
            version: savedVersion
          });
        }

        // Update version history
        setDocumentVersions(prev => ({
          ...prev,
          [docKey]: [
            ...(prev[docKey] || []),
            savedVersion
          ]
        }));
      } catch (error) {
        console.error('Error saving document version:', error);
        // Could implement retry logic here
      }
    }

    // Clear editing state
    editingDocumentsRef.current.delete(docKey);
    setPendingChanges(prev => {
      const updated = { ...prev };
      delete updated[docKey];
      return updated;
    });

    // Let others know editing stopped
    if (socket && connected) {
      socket.emit('documentEditEnded', {
        room: currentRoom,
        entityType,
        entityId
      });
    }
  }, [socket, connected, currentRoom, pendingChanges, getUserInfo]);

  // Create a branch from an existing document version
  const createDocumentBranch = useCallback((entityType, entityId, baseVersionId, branchName) => {
    if (socket && connected) {
      const userData = getUserInfo();
      const branch = VersionControlService.createBranch(baseVersionId, branchName, userData.userId);

      socket.emit('documentBranchCreated', {
        room: currentRoom,
        entityType,
        entityId,
        branch
      });

      return branch;
    }
    return null;
  }, [socket, connected, currentRoom, getUserInfo]);

  // Create a merge request
  const createMergeRequest = useCallback(async (sourceType, sourceId, targetType, targetId, title, description) => {
    if (socket && connected) {
      try {
        const userData = getUserInfo();
        const response = await fetch(`http://localhost:5001/api/${sourceType}s/${sourceId}/merge-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            targetId,
            title: title || `Merge ${sourceType} ${sourceId} to ${targetType} ${targetId}`,
            description: description || `Merge request from ${userData.name}`,
            userId: userData.userId
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create merge request: ${response.status}`);
        }

        const mergeRequest = await response.json();

        // Broadcast merge request to others
        socket.emit('mergeRequestCreated', {
          room: currentRoom,
          mergeRequest
        });

        return mergeRequest;
      } catch (error) {
        console.error('Error creating merge request:', error);
        throw error;
      }
    }
    return null;
  }, [socket, connected, currentRoom, getUserInfo]);

  // Resolve a merge conflict
  const resolveMergeConflict = useCallback((entityType, entityId, resolutionStrategy, manualResolution = null) => {
    const docKey = `${entityType}:${entityId}`;
    const conflict = mergeConflicts[docKey];

    if (!conflict) {
      return null;
    }

    let resolvedContent;

    // Apply resolution strategy
    switch (resolutionStrategy) {
      case 'useLocal':
        resolvedContent = conflict.localChanges.updatedContent;
        break;
      case 'useRemote':
        // Apply remote changes to original content
        resolvedContent = VersionControlService.applyChanges(
          conflict.localChanges.originalContent,
          conflict.remoteChanges.changes
        );
        break;
      case 'manual':
        if (!manualResolution) {
          throw new Error('Manual resolution requires resolved content');
        }
        resolvedContent = manualResolution;
        break;
      default:
        throw new Error(`Unknown resolution strategy: ${resolutionStrategy}`);
    }

    // Mark conflict as resolved
    setMergeConflicts(prev => ({
      ...prev,
      [docKey]: {
        ...conflict,
        resolved: true,
        resolutionStrategy,
        resolvedContent
      }
    }));

    return resolvedContent;
  }, [mergeConflicts]);

  // Get active users for a specific room
  const getActiveUsers = useCallback((roomId) => {
    const collectionRoom = `collection:${roomId}`;
    const workspaceRoom = `workspace:${roomId}`;

    // Check both potential room formats
    return activeRooms[collectionRoom] || activeRooms[workspaceRoom] || [];
  }, [activeRooms]);

  // Get users who are currently typing in a room
  const getTypingUsers = useCallback((roomId) => {
    const collectionRoom = `collection:${roomId}`;
    const workspaceRoom = `workspace:${roomId}`;

    // Check both potential room formats
    return typingUsers[collectionRoom] || typingUsers[workspaceRoom] || [];
  }, [typingUsers]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    if (socket && connected && currentRoom) {
      socket.emit('typingIndicator', {
        room: currentRoom,
        isTyping
      });
    }
  }, [socket, connected, currentRoom]);

  // Request manual reconnection (if auto-reconnect fails)
  const reconnect = useCallback(() => {
    if (socket) {
      setIsReconnecting(true);
      socket.connect();
    }
  }, [socket]);

  // Context value to be provided
  const collaborationValue = {
    socket,
    connected,
    currentRoom,
    connectionError,
    isReconnecting,
    reconnectAttempts,
    joinCollection,
    leaveCollection,
    joinWorkspace,
    leaveWorkspace,
    sendActivity,
    getActiveUsers,
    sendTypingIndicator,
    getTypingUsers,
    reconnect,
    // Version control related methods
    documentVersions,
    pendingChanges,
    mergeConflicts,
    startEditing,
    trackChanges,
    stopEditing,
    loadVersionHistory,
    createDocumentBranch,
    createMergeRequest,
    resolveMergeConflict
  };

  return (
    <CollaborationContext.Provider value={collaborationValue}>
      {children}
    </CollaborationContext.Provider>
  );
};