// utils/socket/socket-server.js
const socketIo = require('socket.io');

// Store for global socket data
const userSockets = new Map(); // Map socketId -> userData

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

    // Set up connection event handlers
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

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
                    userStatus: userData.userStatus || 'online'
                };

                // Explicitly set this on the socket object so other parts can access it
                socket.authenticatedUser = authenticatedUser;

                // Add to global socket store
                userSockets.set(socket.id, {
                    socket,
                    userData: authenticatedUser,
                    rooms: userRooms
                });

                console.log(`User authenticated: ${authenticatedUser.name} (${socket.id})`);

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

            // Notify others in the room that someone joined with consistent data structure
            socket.to(roomName).emit('userJoined', {
                userId: socket.id,
                user: authenticatedUser,
                timestamp: new Date()
            });

            // Get and send current active users in this room with consistent data structure
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            if (roomSockets) {
                const users = Array.from(roomSockets).map(socketId => {
                    const socketInstance = io.sockets.sockets.get(socketId);
                    // Use the authenticatedUser object, or create a fallback with socket ID
                    return socketInstance.authenticatedUser || {
                        id: socketId,
                        name: "Anonymous",
                        displayName: "Anonymous",
                        userStatus: "online"
                    };
                });

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

            console.log(`User ${socket.id} joined room ${roomName}`);
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

                socket.to(roomName).emit('activeUsers', {
                    room: roomName,
                    users: users,
                    timestamp: new Date()
                });
            }

            console.log(`User ${socket.id} left room ${roomName}`);
        };

        // Helper function to get active users in a room
        const getActiveUsersInRoom = (roomName) => {
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            if (!roomSockets) return [];

            return Array.from(roomSockets).map(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                return socketInstance.authenticatedUser || {
                    id: socketId,
                    name: "Anonymous",
                    displayName: "Anonymous",
                    userStatus: "online"
                };
            });
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
                userId: socket.id,
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
                // Optionally broadcast to room that user is still active
                socket.to(room).emit('heartbeat', {
                    userId: socket.id,
                    timestamp: new Date()
                });
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

                if (callback) {
                    callback(users);
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

            // Remove from global socket store
            userSockets.delete(socket.id);

            // Clear user rooms
            userRooms.clear();
        });
    });

    return io;
}

module.exports = {
    initializeSocketServer,
    getUserSockets: () => userSockets
};