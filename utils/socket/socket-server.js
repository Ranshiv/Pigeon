// utils/socket/socket-server.js
const socketIo = require('socket.io');

// Store for global socket data
const userSockets = new Map(); // Map socketId -> userData
let ioInstance = null; // Store the io instance globally

// Protocol session stores
const protocolSessions = {
    websocket: new Map(), // WebSocket sessions
    grpc: new Map(),      // gRPC streaming sessions
    mqtt: new Map(),      // MQTT connection sessions
    sse: new Map()        // SSE connection sessions
};

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 * @return {Object} - Socket.io instance
 */
function initializeSocketServer(server) {
    const io = socketIo(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Store the io instance globally
    ioInstance = io;

    // Set up connection event handlers
    io.on('connection', (socket) => {
        // Remove excessive logging

        // Performance testing telemetry subscription.
        // Lightweight: joins a perf room without collab/user-join side-effects.
        socket.on('perf:subscribe', (runId) => {
            if (!runId || typeof runId !== 'string') return;
            socket.join(`performance:run:${runId}`);
        });
        socket.on('perf:unsubscribe', (runId) => {
            if (!runId || typeof runId !== 'string') return;
            socket.leave(`performance:run:${runId}`);
        });

        // Track user rooms (workspaces/collections they are in)
        const userRooms = new Set();
        let authenticatedUser = null;

        // Authenticate the socket connection with the session
        socket.on('authenticate', async (userData, callback) => {
            try {
                // Store user data with the socket
                authenticatedUser = {
                    id: userData.userId || socket.id,
                    name: userData.name || 'Anonymous',
                    email: userData.email || null,
                    avatar: userData.avatar || null,
                    // Add important fields for consistent overlay display
                    displayName: userData.displayName || userData.name || 'Anonymous',
                    profilePicture: userData.profilePicture || userData.avatar || null,
                    userStatus: userData.userStatus || 'online',
                    socketId: socket.id // Critical for precise WebRTC signaling even if users share account
                };

                // Explicitly set this on the socket object so other parts can access it
                socket.authenticatedUser = authenticatedUser;

                // Add to global socket store
                userSockets.set(socket.id, {
                    socket,
                    userData: authenticatedUser,
                    rooms: userRooms
                });

                // --- NEW: Shared Cursor Handling ---
                socket.on('cursorMove', ({ room, position, route }) => {
                    // Broadcast to everyone in the room EXCEPT sender
                    // Using volatile to drop packets if network congested
                    socket.to(room).volatile.emit('cursorMove', {
                        userId: authenticatedUser.id,
                        position,
                        route
                    });
                });

                // --- NEW: WebRTC Signaling ---
                socket.on('callUser', ({ userToCall, signalData, from }) => {
                    // Find target by either their User ID or Socket ID
                    const targetSocketEntry = Array.from(userSockets.values()).find(u =>
                        u.userData.id === userToCall || u.socket.id === userToCall
                    );

                    if (targetSocketEntry) {
                        // Pass 'from' as the caller's Socket ID if not provided, or better:
                        // Ensure we send a consistent ID that can be used to reply.
                        // If we send socket.id, the reply must target socket.id.
                        io.to(targetSocketEntry.socket.id).emit('callUser', { signal: signalData, from });
                    }
                });

                socket.on('answerCall', ({ signal, to }) => {
                    // 'to' is the caller's ID (could be socket ID or user ID)
                    const targetSocketEntry = Array.from(userSockets.values()).find(u =>
                        u.userData.id === to || u.socket.id === to
                    );

                    if (targetSocketEntry) {
                        io.to(targetSocketEntry.socket.id).emit('callAccepted', signal);
                    }
                });

                socket.on('endCall', ({ to }) => {
                    console.log(`[DEBUG] Server received endCall from ${socket.id} to ${to}`);

                    const targetSocketEntry = Array.from(userSockets.values()).find(u =>
                        u.userData.id === to || u.socket.id === to
                    );

                    if (targetSocketEntry) {
                        console.log(`[DEBUG] Found target socket ${targetSocketEntry.socket.id}, emitting callEnded`);
                        io.to(targetSocketEntry.socket.id).emit('callEnded');
                    } else {
                        console.warn(`[DEBUG] Target user ${to} not found in userSockets`);
                    }
                });

                // Remove excessive logging

                // Send successful authentication response
                if (callback) {
                    callback({
                        success: true,
                        message: 'Authentication successful',
                        userId: authenticatedUser.id,
                        displayName: authenticatedUser.displayName
                    });
                }
            } catch (err) {
                console.error('Authentication error:', err);
                if (callback) {
                    callback({ success: false, message: 'Authentication failed' });
                }
            }
        });

        // Helper function to join a room and notify others
        const joinRoom = (roomName) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to join room ${roomName}`);
                return;
            }

            socket.join(roomName);
            userRooms.add(roomName);

            const dedupeUsersById = (users) => {
                const byId = new Map();
                for (const u of users || []) {
                    if (!u) continue;
                    const id = u.id || u.userId;
                    if (!id) continue;
                    if (!byId.has(id)) {
                        byId.set(id, u);
                    }
                }
                return Array.from(byId.values());
            };

            // Notify others in the room that someone joined with consistent data structure
            socket.to(roomName).emit('userJoined', {
                room: roomName,
                userId: socket.id,
                user: authenticatedUser,
                timestamp: new Date()
            });

            // Get and send current active users in this room with consistent data structure
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            if (roomSockets) {
                const users = dedupeUsersById(Array.from(roomSockets).map(socketId => {
                    const socketInstance = io.sockets.sockets.get(socketId);
                    // Use the authenticatedUser object, or create a fallback with socket ID
                    return socketInstance.authenticatedUser || {
                        id: socketId,
                        name: "Anonymous",
                        displayName: "Anonymous",
                        userStatus: "online"
                    };
                }));

                // Send to the joining user the list of active users
                socket.emit('activeUsers', {
                    room: roomName,
                    users: users,
                    timestamp: new Date()
                });

                // Also broadcast to everyone else so they all have the latest
                socket.to(roomName).emit('activeUsers', {
                    room: roomName,
                    users: users,
                    timestamp: new Date()
                });
            }

            // Remove excessive logging to prevent console spam
        };

        // Helper function to leave a room and notify others
        const leaveRoom = (roomName) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to leave room ${roomName}`);
                return;
            }

            socket.leave(roomName);
            userRooms.delete(roomName);

            // Notify others in the room with consistent data structure
            socket.to(roomName).emit('userLeft', {
                room: roomName,
                userId: socket.id,
                user: authenticatedUser,
                timestamp: new Date()
            });

            // Send updated list of active users to all remaining users
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            if (roomSockets) {
                const users = Array.from(roomSockets).map(socketId => {
                    const socketInstance = io.sockets.sockets.get(socketId);
                    return socketInstance.authenticatedUser || {
                        id: socketId,
                        name: "Anonymous",
                        displayName: "Anonymous",
                        userStatus: "online"
                    };
                });

                const byId = new Map();
                for (const u of users) {
                    if (!u || !u.id) continue;
                    if (!byId.has(u.id)) byId.set(u.id, u);
                }
                const dedupedUsers = Array.from(byId.values());

                socket.to(roomName).emit('activeUsers', {
                    room: roomName,
                    users: dedupedUsers,
                    timestamp: new Date()
                });
            }

            // Remove excessive logging to prevent console spam
        };

        // Helper function to get active users in a room
        const getActiveUsersInRoom = (roomName) => {
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            if (!roomSockets) return [];

            const users = Array.from(roomSockets).map(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                return socketInstance.authenticatedUser || {
                    id: socketId,
                    name: "Anonymous",
                    displayName: "Anonymous",
                    userStatus: "online"
                };
            });

            const byId = new Map();
            for (const u of users) {
                if (!u || !u.id) continue;
                if (!byId.has(u.id)) byId.set(u.id, u);
            }
            return Array.from(byId.values());
        };

        // Join a workspace room
        socket.on('joinWorkspace', (workspaceId) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to join workspace ${workspaceId}`);
                return;
            }

            // Create a room name for this workspace
            const roomName = `workspace:${workspaceId}`;
            joinRoom(roomName);
        });

        // Leave a workspace room
        socket.on('leaveWorkspace', (workspaceId) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to leave workspace ${workspaceId}`);
                return;
            }

            const roomName = `workspace:${workspaceId}`;
            if (userRooms.has(roomName)) {
                leaveRoom(roomName);
            } else {
                console.warn(`User ${socket.id} attempted to leave a workspace room they're not in: ${roomName}`);
            }
        });

        // Join a collection room
        socket.on('joinCollection', (collectionId) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to join collection ${collectionId}`);
                return;
            }

            const roomName = `collection:${collectionId}`;
            joinRoom(roomName);
        });

        // Leave a collection room
        socket.on('leaveCollection', (collectionId) => {
            if (!authenticatedUser) {
                console.warn(`Unauthenticated user ${socket.id} attempted to leave collection ${collectionId}`);
                return;
            }

            const roomName = `collection:${collectionId}`;
            if (userRooms.has(roomName)) {
                leaveRoom(roomName);
            } else {
                console.warn(`User ${socket.id} attempted to leave a collection room they're not in: ${roomName}`);
            }
        });

        // Handle user activity broadcasts
        socket.on('userActivity', ({ room, activity }) => {
            if (!authenticatedUser) {
                console.warn('Unauthenticated user activity received');
                return;
            }

            console.log(`Activity in ${room}:`, activity);

            // Broadcast to others in the room
            socket.to(room).emit('userActivity', {
                userId: authenticatedUser.id || socket.id,
                user: authenticatedUser,
                activity,
                timestamp: new Date()
            });
        });

        // Handle typing indicators
        socket.on('typingIndicator', ({ room, isTyping }) => {
            if (!authenticatedUser) return;

            socket.to(room).emit('typingIndicator', {
                userId: socket.id,
                user: authenticatedUser,
                isTyping,
                timestamp: new Date()
            });
        });

        // Handle heartbeats to keep track of active users
        socket.on('heartbeat', ({ room }) => {
            // Refresh the user's presence in the room
            if (userRooms.has(room)) {
                // No broadcast needed; clients use heartbeat only to keep the connection warm.
                socket.lastHeartbeatAt = Date.now();
            }
        });

        // Request for active users in a specific room
        socket.on('getActiveUsers', ({ room }, callback) => {
            const roomSockets = io.sockets.adapter.rooms.get(room);

            if (roomSockets) {
                const users = Array.from(roomSockets).map(socketId => {
                    const socketInstance = io.sockets.sockets.get(socketId);
                    return socketInstance.authenticatedUser || { id: socketId };
                });

                const byId = new Map();
                for (const u of users) {
                    if (!u || !u.id) continue;
                    if (!byId.has(u.id)) byId.set(u.id, u);
                }
                const dedupedUsers = Array.from(byId.values());

                if (callback) {
                    callback(dedupedUsers);
                }
            } else if (callback) {
                callback([]);
            }
        });

        // VERSION CONTROL AND COLLABORATIVE EDITING HANDLERS

        // Handle document editing started
        socket.on('documentEditStarted', ({ room, entityType, entityId }) => {
            if (!authenticatedUser) return;

            // Broadcast to room that user started editing
            socket.to(room).emit('documentEditStarted', {
                userId: socket.id,
                user: authenticatedUser,
                entityType,
                entityId,
                timestamp: new Date()
            });

            console.log(`User ${socket.id} started editing ${entityType}:${entityId}`);
        });

        // Handle document editing ended
        socket.on('documentEditEnded', ({ room, entityType, entityId }) => {
            if (!authenticatedUser) return;

            // Broadcast to room that user stopped editing
            socket.to(room).emit('documentEditEnded', {
                userId: socket.id,
                user: authenticatedUser,
                entityType,
                entityId,
                timestamp: new Date()
            });

            console.log(`User ${socket.id} stopped editing ${entityType}:${entityId}`);
        });

        // Handle document version changed
        socket.on('documentVersionChanged', ({ room, entityType, entityId, version }) => {
            if (!authenticatedUser) return;

            // Broadcast version change to all users in the room
            socket.to(room).emit('documentVersionChanged', {
                userId: socket.id,
                user: authenticatedUser,
                entityType,
                entityId,
                version,
                timestamp: new Date()
            });

            console.log(`User ${socket.id} created new version of ${entityType}:${entityId}`);

            // Also save version to database (simplified; in production would store in MongoDB)
            try {
                // In a real implementation, this would store the version in the database
                console.log(`Saving version for ${entityType}:${entityId}`, version);

                // Log the activity
                const activityData = {
                    type: 'version_created',
                    entityType,
                    entityId,
                    userId: authenticatedUser.id,
                    userName: authenticatedUser.name,
                    timestamp: new Date(),
                    versionId: version.id,
                    changes: version.changes
                };

                // In a real implementation, store this activity
                console.log('New activity logged:', activityData);
            } catch (error) {
                console.error('Error storing version:', error);
            }
        });

        // Handle document branch created
        socket.on('documentBranchCreated', ({ room, entityType, entityId, branch }) => {
            if (!authenticatedUser) return;

            // Broadcast branch creation to all users in the room
            socket.to(room).emit('documentBranchCreated', {
                userId: socket.id,
                user: authenticatedUser,
                entityType,
                entityId,
                branch,
                timestamp: new Date()
            });

            console.log(`User ${socket.id} created branch ${branch.name} for ${entityType}:${entityId}`);
        });

        // Handle merge request created
        socket.on('mergeRequestCreated', ({ room, mergeRequest }) => {
            if (!authenticatedUser) return;

            // Broadcast merge request to all users in the room
            socket.to(room).emit('mergeRequestCreated', {
                userId: socket.id,
                user: authenticatedUser,
                mergeRequest,
                timestamp: new Date()
            });

            console.log(`User ${socket.id} created merge request: ${mergeRequest.title || mergeRequest._id}`);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            // Notify all rooms this user was in
            for (const room of userRooms) {
                socket.to(room).emit('userLeft', {
                    userId: socket.id,
                    user: authenticatedUser,
                    timestamp: new Date(),
                    reason: 'disconnect'
                });
            }

            // Clean up protocol sessions for this socket
            cleanupProtocolSessions(socket.id);

            // Remove from global socket store
            userSockets.delete(socket.id);

            // Clear user rooms
            userRooms.clear();
        });

        // ==========================================
        // PROTOCOL TESTING REAL-TIME HANDLERS
        // ==========================================

        // WebSocket Protocol Testing
        socket.on('protocol:websocket:connect', async ({ url, protocols, headers }, callback) => {
            try {
                const WebSocket = require('ws');
                const ws = new WebSocket(url, protocols, { headers });
                const sessionId = `ws_${socket.id}_${Date.now()}`;

                ws.on('open', () => {
                    protocolSessions.websocket.set(sessionId, { ws, url, connectedAt: new Date() });
                    socket.emit('protocol:websocket:connected', { sessionId, url });
                });

                ws.on('message', (data) => {
                    socket.emit('protocol:websocket:message', {
                        sessionId,
                        data: data.toString(),
                        timestamp: new Date()
                    });
                });

                ws.on('close', (code, reason) => {
                    socket.emit('protocol:websocket:disconnected', { sessionId, code, reason: reason.toString() });
                    protocolSessions.websocket.delete(sessionId);
                });

                ws.on('error', (error) => {
                    socket.emit('protocol:websocket:error', { sessionId, error: error.message });
                });

                if (callback) callback({ success: true, sessionId });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:websocket:send', ({ sessionId, message }, callback) => {
            try {
                const session = protocolSessions.websocket.get(sessionId);
                if (!session) {
                    if (callback) callback({ success: false, error: 'Session not found' });
                    return;
                }
                session.ws.send(message);
                if (callback) callback({ success: true });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:websocket:disconnect', ({ sessionId }, callback) => {
            try {
                const session = protocolSessions.websocket.get(sessionId);
                if (session) {
                    session.ws.close();
                    protocolSessions.websocket.delete(sessionId);
                }
                if (callback) callback({ success: true });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        // MQTT Protocol Testing
        socket.on('protocol:mqtt:connect', async ({ brokerUrl, options }, callback) => {
            try {
                const mqtt = require('mqtt');
                const sessionId = `mqtt_${socket.id}_${Date.now()}`;
                const client = mqtt.connect(brokerUrl, options);

                client.on('connect', () => {
                    protocolSessions.mqtt.set(sessionId, {
                        client,
                        brokerUrl,
                        subscriptions: new Set(),
                        connectedAt: new Date()
                    });
                    socket.emit('protocol:mqtt:connected', { sessionId, brokerUrl });
                });

                client.on('message', (topic, message) => {
                    socket.emit('protocol:mqtt:message', {
                        sessionId,
                        topic,
                        message: message.toString(),
                        timestamp: new Date()
                    });
                });

                client.on('close', () => {
                    socket.emit('protocol:mqtt:disconnected', { sessionId });
                    protocolSessions.mqtt.delete(sessionId);
                });

                client.on('error', (error) => {
                    socket.emit('protocol:mqtt:error', { sessionId, error: error.message });
                });

                if (callback) callback({ success: true, sessionId });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:mqtt:subscribe', ({ sessionId, topic, qos = 0 }, callback) => {
            try {
                const session = protocolSessions.mqtt.get(sessionId);
                if (!session) {
                    if (callback) callback({ success: false, error: 'Session not found' });
                    return;
                }
                session.client.subscribe(topic, { qos }, (err) => {
                    if (err) {
                        if (callback) callback({ success: false, error: err.message });
                    } else {
                        session.subscriptions.add(topic);
                        if (callback) callback({ success: true });
                    }
                });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:mqtt:publish', ({ sessionId, topic, message, options = {} }, callback) => {
            try {
                const session = protocolSessions.mqtt.get(sessionId);
                if (!session) {
                    if (callback) callback({ success: false, error: 'Session not found' });
                    return;
                }
                session.client.publish(topic, message, options, (err) => {
                    if (callback) callback({ success: !err, error: err?.message });
                });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:mqtt:unsubscribe', ({ sessionId, topic }, callback) => {
            try {
                const session = protocolSessions.mqtt.get(sessionId);
                if (!session) {
                    if (callback) callback({ success: false, error: 'Session not found' });
                    return;
                }
                session.client.unsubscribe(topic, (err) => {
                    if (!err) session.subscriptions.delete(topic);
                    if (callback) callback({ success: !err, error: err?.message });
                });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:mqtt:disconnect', ({ sessionId }, callback) => {
            try {
                const session = protocolSessions.mqtt.get(sessionId);
                if (session) {
                    session.client.end();
                    protocolSessions.mqtt.delete(sessionId);
                }
                if (callback) callback({ success: true });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        // SSE Protocol Testing
        socket.on('protocol:sse:connect', async ({ url, options = {} }, callback) => {
            try {
                const EventSource = require('eventsource');
                const sessionId = `sse_${socket.id}_${Date.now()}`;
                const es = new EventSource(url, options);

                es.onopen = () => {
                    protocolSessions.sse.set(sessionId, { es, url, connectedAt: new Date() });
                    socket.emit('protocol:sse:connected', { sessionId, url });
                };

                es.onmessage = (event) => {
                    socket.emit('protocol:sse:event', {
                        sessionId,
                        type: 'message',
                        data: event.data,
                        lastEventId: event.lastEventId,
                        timestamp: new Date()
                    });
                };

                es.onerror = (error) => {
                    socket.emit('protocol:sse:error', { sessionId, error: 'Connection error' });
                };

                if (callback) callback({ success: true, sessionId });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('protocol:sse:disconnect', ({ sessionId }, callback) => {
            try {
                const session = protocolSessions.sse.get(sessionId);
                if (session) {
                    session.es.close();
                    protocolSessions.sse.delete(sessionId);
                }
                if (callback) callback({ success: true });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });

        // gRPC Streaming Support
        socket.on('protocol:grpc:stream', async ({ sessionId, serviceName, methodName, messages }, callback) => {
            try {
                // gRPC streaming would be handled by the gRPC service
                // This event allows real-time updates during streaming calls
                socket.emit('protocol:grpc:streamUpdate', {
                    sessionId,
                    serviceName,
                    methodName,
                    status: 'streaming',
                    timestamp: new Date()
                });
                if (callback) callback({ success: true });
            } catch (error) {
                if (callback) callback({ success: false, error: error.message });
            }
        });
    });

    return io;
}

/**
 * Clean up protocol sessions for a disconnected socket
 */
function cleanupProtocolSessions(socketId) {
    // Clean up WebSocket sessions
    for (const [sessionId, session] of protocolSessions.websocket) {
        if (sessionId.includes(socketId)) {
            try { session.ws.close(); } catch (e) { }
            protocolSessions.websocket.delete(sessionId);
        }
    }

    // Clean up MQTT sessions
    for (const [sessionId, session] of protocolSessions.mqtt) {
        if (sessionId.includes(socketId)) {
            try { session.client.end(); } catch (e) { }
            protocolSessions.mqtt.delete(sessionId);
        }
    }

    // Clean up SSE sessions
    for (const [sessionId, session] of protocolSessions.sse) {
        if (sessionId.includes(socketId)) {
            try { session.es.close(); } catch (e) { }
            protocolSessions.sse.delete(sessionId);
        }
    }
}

module.exports = {
    initializeSocketServer,
    getUserSockets: () => userSockets,
    getIO: () => ioInstance,
    getProtocolSessions: () => protocolSessions,
    cleanupProtocolSessions
};