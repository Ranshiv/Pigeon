// client/src/context/CollaborationContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';


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

  // --- NEW: Collaboration State ---
  // WebRTC State
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [callPartnerId, setCallPartnerId] = useState(null); // Robust tracking of partner ID

  const userVideo = useRef();
  const partnerVideo = useRef();
  const connectionRef = useRef();
  const streamRef = useRef(null); // Add Ref to access stream inside socket listeners

  // Use a ref to track rooms for rejoining on reconnect
  const roomsRef = useRef(new Set());
  // Add ref for tracking currently edited documents
  const editingDocumentsRef = useRef(new Map());
  // Track the current room without forcing callbacks to depend on state
  const currentRoomRef = useRef(null);
  // Rate-limit activity events to avoid notification floods
  const lastActivityRef = useRef(new Map());

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const normalizeUsers = useCallback((users) => {
    const list = Array.isArray(users) ? users : [];
    const byId = new Map();

    for (const u of list) {
      if (!u) continue;
      const id = (typeof u === 'string') ? u : (u.id || u.userId);
      if (!id) continue;

      // Prefer the first full object we see for an id
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: (typeof u === 'object' ? u.name : undefined),
          email: (typeof u === 'object' ? u.email : undefined),
          avatar: (typeof u === 'object' ? u.avatar : undefined),
          joinedAt: new Date()
        });
      } else {
        const existing = byId.get(id);
        if (typeof u === 'object') {
          byId.set(id, {
            ...existing,
            name: existing.name || u.name,
            email: existing.email || u.email,
            avatar: existing.avatar || u.avatar
          });
        }
      }
    }

    return Array.from(byId.values());
  }, []);

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
      setActiveRooms(prev => ({
        ...prev,
        [room]: normalizeUsers(users)
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

    // Listen for completion events
    socketInstance.on('mergeCompleted', ({ sourceId, targetId, success, conflicts }) => {
      // Only log failures and conflicts, not every merge operation
      if (!success && conflicts) {
        console.error('Merge conflicts detected:', conflicts);
        // Handle conflicts in the UI
      }
    });

    // --- NEW: Review Request Events ---
    socketInstance.on('reviewCreated', (review) => {
      addNotification(`New review request: ${review.title}`);
      // Refresh reviews list logic here if needed
    });

    socketInstance.on('reviewUpdated', (review) => {
      // Notification for status change
      if (review.status === 'approved') addNotification(`Review approved: ${review.title}`);
    });

    // --- NEW: WebRTC Signaling Events ---
    socketInstance.on('callUser', ({ from, signal }) => {
      setIncomingCall({ from, signal });
      setCallPartnerId(from); // Track who is calling us so we can end call later
    });

    socketInstance.on('callAccepted', (signal) => {
      setCallAccepted(true);
      // Logic to complete the peer connection
      if (connectionRef.current) connectionRef.current.signal(signal);
    });

    socketInstance.on('callEnded', () => {
      console.log('[DEBUG] 📞 Received callEnded event from server! Stopping call.');
      setCallEnded(true);
      setCallAccepted(false);
      setIncomingCall(null);
      setOutgoingCall(null);
      setCallPartnerId(null);

      if (connectionRef.current) {
        try {
          connectionRef.current.destroy();
        } catch (e) {
          console.warn("Peer destroy error ignored:", e);
        }
      }

      // Use Ref to get the active stream regardless of closure staleness
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Stream stop error ignored:", e);
        }
        streamRef.current = null;
        setStream(null);
      } else if (stream) {
        // Fallback if Ref wasn't set (shouldn't happen with new enableMedia)
        setStream(null);
      }
    });


    // Implement heartbeat to keep connection alive and verify active status
    const heartbeatInterval = setInterval(() => {
      const room = currentRoomRef.current;
      if (socketInstance.connected && room) {
        socketInstance.emit('heartbeat', { room });
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

  const reconnect = useCallback(() => {
    if (socket) { // && !connected check might prevent forced reconnects
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  useEffect(() => {
    // Request media permissions on load or on demand? On demand is better.
    // For now, we won't auto-request to avoid permission blocking on page load
  }, []);

  const enableMedia = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      streamRef.current = currentStream; // Update Ref
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
      return currentStream;
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const callUser = async (idToCall) => {
    // Lazy load simple-peer to avoid issues during SSR or initial load if polyfills missing
    const Peer = (await import('simple-peer')).default;

    const currentStream = stream || await enableMedia();
    if (!currentStream) return;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: currentStream
    });

    peer.on('signal', (data) => {
      socket.emit('callUser', {
        userToCall: idToCall,
        signalData: data,
        from: socket.id
      });
    });

    peer.on('stream', (currentStream) => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = currentStream;
      }
    });



    connectionRef.current = peer;
    setOutgoingCall(idToCall);
    setCallPartnerId(idToCall); // Track who we are calling
  };

  const answerCall = async () => {
    setCallAccepted(true);
    const Peer = (await import('simple-peer')).default;

    const currentStream = stream || await enableMedia();
    if (!currentStream) return;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: currentStream
    });

    peer.on('signal', (data) => {
      socket.emit('answerCall', { signal: data, to: incomingCall.from });
    });

    peer.on('stream', (currentStream) => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = currentStream;
      }
    });

    peer.signal(incomingCall.signal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    console.log('[DEBUG] leaveCall triggered');

    // 1. Immediate UI Cleanup (Optimistic and Priority)
    setCallEnded(true);
    setCallAccepted(false); // Important to hide overlay immediately
    setIncomingCall(null);
    setOutgoingCall(null);

    // 2. Network Signaling
    const partnerId = callPartnerId || outgoingCall || (incomingCall ? incomingCall.from : null);

    console.log('[DEBUG] leaveCall logic. Partner ID:', partnerId);
    if (partnerId && socket) {
      console.log('[DEBUG] Emitting endCall to:', partnerId);
      socket.emit('endCall', { to: partnerId });
    } else {
      console.warn('[DEBUG] Could not emit endCall (state might be cleared already used cached ID). PartnerId:', partnerId);
    }

    // 3. WebRTC Cleanup (Safeguarded)
    if (connectionRef.current) {
      try {
        connectionRef.current.destroy();
      } catch (e) {
        console.warn("Peer destroy error ignored:", e);
      }
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn("Stream stop error ignored:", e);
      }
      streamRef.current = null;
    }
    setStream(null);
    setCallPartnerId(null);

    // window.location.reload(); // Removed
  };



  // --- Missing Functions Restoration ---

  const joinCollection = useCallback((collectionId) => {
    if (socket && connected) {
      // Correctly emit the event the server expects
      socket.emit('joinCollection', collectionId);
      const room = `collection:${collectionId}`;
      setCurrentRoom(room);
      roomsRef.current.add(room);
    }
  }, [socket, connected]);

  const leaveCollection = useCallback((collectionId) => {
    if (socket && connected) {
      socket.emit('leaveCollection', collectionId);
      const room = `collection:${collectionId}`;
      if (currentRoom === room) {
        setCurrentRoom(null);
      }
      roomsRef.current.delete(room);
    }
  }, [socket, connected, currentRoom]);

  const joinWorkspace = useCallback((workspaceId) => {
    if (socket && connected) {
      socket.emit('joinWorkspace', workspaceId);
      const room = `workspace:${workspaceId}`;
      setCurrentRoom(room);
      roomsRef.current.add(room);
    }
  }, [socket, connected]);

  const leaveWorkspace = useCallback((workspaceId) => {
    if (socket && connected) {
      socket.emit('leaveWorkspace', workspaceId);
      const room = `workspace:${workspaceId}`;
      if (currentRoom === room) {
        setCurrentRoom(null);
      }
      roomsRef.current.delete(room);
    }
  }, [socket, connected, currentRoom]);

  const sendActivity = useCallback((action, data) => {
    if (socket && connected && currentRoom) {
      // Rate limit logging
      const key = `${action}:${JSON.stringify(data)}`;
      const now = Date.now();
      if (lastActivityRef.current.has(key) && now - lastActivityRef.current.get(key) < 5000) {
        return;
      }
      lastActivityRef.current.set(key, now);

      socket.emit('activity', { room: currentRoom, action, data });
    }
  }, [socket, connected, currentRoom]);

  const getActiveUsers = useCallback(() => {
    if (activeRooms[currentRoom]) {
      return activeRooms[currentRoom];
    }
    return [];
  }, [activeRooms, currentRoom]);

  const sendTypingIndicator = useCallback((isTyping) => {
    if (socket && connected && currentRoom) {
      socket.emit('typing', { room: currentRoom, isTyping });
    }
  }, [socket, connected, currentRoom]);

  const getTypingUsers = useCallback(() => {
    if (typingUsers[currentRoom]) {
      return typingUsers[currentRoom];
    }
    return [];
  }, [typingUsers, currentRoom]);

  // Version Control Methods (Proxies to Service or simpler socket events)
  const startEditing = useCallback((docId) => {
    // Logic for locking or signaling editing
  }, []);

  const stopEditing = useCallback((docId) => {
    // Logic for unlocking
  }, []);

  const trackChanges = useCallback((docId, changes) => {
    // Logic for OT or diffs
  }, []);

  const loadVersionHistory = useCallback(async (docId) => {
    // API call placeholder
    return [];
  }, []);

  const createDocumentBranch = useCallback(async (docId, branchName) => {
    // API call placeholder
  }, []);

  const createMergeRequest = useCallback(async (sourceId, targetId) => {
    // API call placeholder
  }, []);

  const resolveMergeConflict = useCallback(async (mergeId, resolution) => {
    // API call placeholder
  }, []);

  const addNotification = useCallback((message) => {
    toast.info(message, {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
    });
  }, []);


  // Context value to be provided
  const collaborationValue = {
    socket,
    connected,
    currentRoom,
    activeRooms, // Added activeRooms to context
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
    resolveMergeConflict,
    // New Features
    // WebRTC
    stream,
    incomingCall,
    outgoingCall,
    callAccepted,
    callEnded,
    userVideo,
    partnerVideo,
    callUser,
    answerCall,
    leaveCall,
    enableMedia,
    addNotification
  };

  return (
    <CollaborationContext.Provider value={collaborationValue}>
      {children}
    </CollaborationContext.Provider>
  );
};