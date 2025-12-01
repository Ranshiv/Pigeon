// services/TrafficRecorder.js
const MockServer = require('../models/MockServer');
const MockRecording = require('../models/MockRecording');
const { getIO } = require('../utils/socket/socket-server');
const { v4: uuidv4 } = require('uuid');

/**
 * TrafficRecorder Service
 * Handles traffic recording and replay for mock servers
 */
class TrafficRecorder {
    /**
     * Start recording traffic for a mock server
     */
    static async startRecording(mockServerId, userId, options = {}) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            // Check if already recording
            if (mockServer.recording?.isRecording) {
                throw new Error('Recording is already in progress');
            }

            // Generate session ID
            const sessionId = uuidv4();
            const name = options.name || `Recording ${new Date().toLocaleString()}`;

            // Create recording document
            const recording = new MockRecording({
                mockServerId,
                name,
                description: options.description || '',
                sessionId,
                status: 'recording',
                startedAt: new Date(),
                tags: options.tags || [],
                createdBy: userId
            });

            await recording.save();

            // Update mock server recording state
            mockServer.recording = {
                isRecording: true,
                recordingStartedAt: new Date(),
                currentSessionId: sessionId
            };

            await mockServer.save();

            // Emit recording started event
            this.emitRecordingEvent('mock:recording:started', {
                mockServerId,
                sessionId,
                recordingId: recording._id,
                name
            });

            return {
                message: 'Recording started',
                sessionId,
                recordingId: recording._id,
                name,
                startedAt: mockServer.recording.recordingStartedAt
            };
        } catch (error) {
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }

    /**
     * Stop recording traffic for a mock server
     */
    static async stopRecording(mockServerId, force = false) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.recording?.isRecording && !force) {
                throw new Error('No recording in progress');
            }

            const sessionId = mockServer.recording?.currentSessionId;

            // Update recording document if it exists
            let recording = null;
            if (sessionId) {
                recording = await MockRecording.findOne({ sessionId });
                if (recording) {
                    recording.status = 'completed';
                    recording.endedAt = new Date();
                    recording.stats.totalDuration = recording.endedAt - recording.startedAt;
                    await recording.save();
                }
            }

            // Clear mock server recording state
            const startedAt = mockServer.recording?.recordingStartedAt;
            mockServer.recording = {
                isRecording: false,
                recordingStartedAt: null,
                currentSessionId: null
            };

            await mockServer.save();

            // Emit recording stopped event
            this.emitRecordingEvent('mock:recording:stopped', {
                mockServerId,
                sessionId,
                recordingId: recording?._id,
                requestCount: recording?.requests?.length || 0,
                duration: recording?.stats?.totalDuration || 0
            });

            return {
                message: 'Recording stopped',
                sessionId,
                recordingId: recording?._id,
                requestCount: recording?.requests?.length || 0,
                duration: recording?.stats?.totalDuration || 0,
                startedAt,
                endedAt: recording?.endedAt
            };
        } catch (error) {
            throw new Error(`Failed to stop recording: ${error.message}`);
        }
    }

    /**
     * Get recording status for a mock server
     */
    static async getRecordingStatus(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('recording name');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.recording?.isRecording) {
                return {
                    isRecording: false,
                    mockServerName: mockServer.name
                };
            }

            const recording = await MockRecording.findOne({
                sessionId: mockServer.recording.currentSessionId
            }).select('requests.length name');

            return {
                isRecording: true,
                sessionId: mockServer.recording.currentSessionId,
                startedAt: mockServer.recording.recordingStartedAt,
                requestCount: recording?.requests?.length || 0,
                recordingName: recording?.name,
                mockServerName: mockServer.name
            };
        } catch (error) {
            throw new Error(`Failed to get recording status: ${error.message}`);
        }
    }

    /**
     * Get all recordings for a mock server
     */
    static async getRecordings(mockServerId, options = {}) {
        try {
            const { page = 1, limit = 20, status, tags } = options;

            const query = { mockServerId };
            if (status) query.status = status;
            if (tags && tags.length > 0) query.tags = { $in: tags };

            const recordings = await MockRecording.find(query)
                .select('name description sessionId status startedAt endedAt stats tags createdBy createdAt')
                .populate('createdBy', 'displayName email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            const total = await MockRecording.countDocuments(query);

            return {
                recordings,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get recordings: ${error.message}`);
        }
    }

    /**
     * Get a specific recording by ID
     */
    static async getRecording(recordingId) {
        try {
            const recording = await MockRecording.findById(recordingId)
                .populate('createdBy', 'displayName email');

            if (!recording) {
                throw new Error('Recording not found');
            }

            return recording;
        } catch (error) {
            throw new Error(`Failed to get recording: ${error.message}`);
        }
    }

    /**
     * Delete a recording
     */
    static async deleteRecording(recordingId) {
        try {
            const recording = await MockRecording.findById(recordingId);
            if (!recording) {
                throw new Error('Recording not found');
            }

            // Check if this recording is currently active
            const mockServer = await MockServer.findById(recording.mockServerId);
            if (mockServer?.recording?.currentSessionId === recording.sessionId) {
                throw new Error('Cannot delete an active recording');
            }

            await MockRecording.findByIdAndDelete(recordingId);

            return { message: 'Recording deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete recording: ${error.message}`);
        }
    }

    /**
     * Rename a recording
     */
    static async renameRecording(recordingId, name, description) {
        try {
            const recording = await MockRecording.findById(recordingId);
            if (!recording) {
                throw new Error('Recording not found');
            }

            if (name) recording.name = name;
            if (description !== undefined) recording.description = description;

            await recording.save();

            return {
                message: 'Recording updated',
                name: recording.name,
                description: recording.description
            };
        } catch (error) {
            throw new Error(`Failed to rename recording: ${error.message}`);
        }
    }

    /**
     * Replay a recording against a target URL
     */
    static async replayRecording(recordingId, options = {}) {
        const axios = require('axios');

        try {
            const recording = await MockRecording.findById(recordingId);
            if (!recording) {
                throw new Error('Recording not found');
            }

            if (recording.requests.length === 0) {
                throw new Error('Recording has no requests to replay');
            }

            const {
                targetUrl = null, // If null, replay against the mock server itself
                speed = 1, // Replay speed multiplier (1 = real-time, 2 = 2x speed)
                preserveTiming = true,
                onProgress = null
            } = options;

            const mockServer = await MockServer.findById(recording.mockServerId);
            const baseUrl = targetUrl || `http://localhost:${process.env.PORT || 5001}/api/mock-servers/${recording.mockServerId}/simulate`;

            const results = [];
            let previousTimestamp = null;

            for (let i = 0; i < recording.requests.length; i++) {
                const request = recording.requests[i];

                // Apply timing delay if preserving timing
                if (preserveTiming && previousTimestamp && speed > 0) {
                    const timeDiff = new Date(request.timestamp) - new Date(previousTimestamp);
                    const delay = Math.max(0, timeDiff / speed);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                try {
                    const url = `${baseUrl}${request.path}`;
                    const startTime = Date.now();

                    const response = await axios({
                        method: request.method,
                        url,
                        params: Object.fromEntries(request.queryParams || new Map()),
                        headers: Object.fromEntries(request.headers || new Map()),
                        data: request.body,
                        validateStatus: () => true,
                        timeout: 30000
                    });

                    const duration = Date.now() - startTime;

                    results.push({
                        index: i,
                        success: true,
                        request: {
                            method: request.method,
                            path: request.path
                        },
                        originalResponse: {
                            status: request.response?.status,
                            duration: request.response?.duration
                        },
                        replayResponse: {
                            status: response.status,
                            duration,
                            body: response.data
                        },
                        match: request.response?.status === response.status
                    });

                    // Call progress callback if provided
                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total: recording.requests.length,
                            result: results[results.length - 1]
                        });
                    }

                    // Emit progress event
                    this.emitRecordingEvent('mock:replay:progress', {
                        recordingId,
                        current: i + 1,
                        total: recording.requests.length,
                        match: request.response?.status === response.status
                    });

                } catch (error) {
                    results.push({
                        index: i,
                        success: false,
                        request: {
                            method: request.method,
                            path: request.path
                        },
                        error: error.message
                    });
                }

                previousTimestamp = request.timestamp;
            }

            // Update recording replay stats
            recording.replay.lastReplayedAt = new Date();
            recording.replay.replayCount++;
            await recording.save();

            // Calculate summary
            const successCount = results.filter(r => r.success).length;
            const matchCount = results.filter(r => r.match).length;

            return {
                recordingId,
                recordingName: recording.name,
                totalRequests: recording.requests.length,
                successfulRequests: successCount,
                matchingResponses: matchCount,
                results
            };
        } catch (error) {
            throw new Error(`Failed to replay recording: ${error.message}`);
        }
    }

    /**
     * Export recording to HAR format
     */
    static async exportToHAR(recordingId) {
        try {
            const recording = await MockRecording.findById(recordingId);
            if (!recording) {
                throw new Error('Recording not found');
            }

            return recording.toHAR();
        } catch (error) {
            throw new Error(`Failed to export to HAR: ${error.message}`);
        }
    }

    /**
     * Import recording from HAR format
     */
    static async importFromHAR(mockServerId, userId, harData, options = {}) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            // Parse HAR data
            const har = typeof harData === 'string' ? JSON.parse(harData) : harData;

            if (!har?.log?.entries || har.log.entries.length === 0) {
                throw new Error('Invalid HAR format or no entries found');
            }

            const sessionId = uuidv4();
            const name = options.name || `HAR Import ${new Date().toLocaleString()}`;

            // Create recording from HAR entries
            const recording = new MockRecording({
                mockServerId,
                name,
                description: options.description || `Imported from HAR file`,
                sessionId,
                status: 'completed',
                startedAt: new Date(har.log.entries[0]?.startedDateTime || Date.now()),
                endedAt: new Date(har.log.entries[har.log.entries.length - 1]?.startedDateTime || Date.now()),
                tags: options.tags || ['imported', 'har'],
                createdBy: userId
            });

            // Convert HAR entries to recording requests
            for (const entry of har.log.entries) {
                const request = entry.request;
                const response = entry.response;

                // Parse headers
                const reqHeaders = new Map();
                (request.headers || []).forEach(h => reqHeaders.set(h.name, h.value));

                const resHeaders = new Map();
                (response.headers || []).forEach(h => resHeaders.set(h.name, h.value));

                // Parse query params
                const queryParams = new Map();
                (request.queryString || []).forEach(q => queryParams.set(q.name, q.value));

                // Parse request body
                let requestBody = null;
                if (request.postData?.text) {
                    try {
                        requestBody = JSON.parse(request.postData.text);
                    } catch {
                        requestBody = request.postData.text;
                    }
                }

                // Parse response body
                let responseBody = null;
                if (response.content?.text) {
                    try {
                        responseBody = JSON.parse(response.content.text);
                    } catch {
                        responseBody = response.content.text;
                    }
                }

                // Extract path from URL
                const url = new URL(request.url);
                const path = url.pathname;

                recording.requests.push({
                    timestamp: new Date(entry.startedDateTime),
                    method: request.method,
                    path,
                    fullUrl: request.url,
                    headers: reqHeaders,
                    queryParams,
                    body: requestBody,
                    response: {
                        status: response.status,
                        statusText: response.statusText,
                        headers: resHeaders,
                        body: responseBody,
                        duration: entry.time || 0
                    },
                    metadata: {
                        requestSize: request.bodySize || 0,
                        responseSize: response.bodySize || 0
                    }
                });
            }

            // Calculate stats
            recording.stats.totalRequests = recording.requests.length;
            for (const req of recording.requests) {
                const method = req.method.toUpperCase();
                recording.stats.requestsByMethod.set(
                    method,
                    (recording.stats.requestsByMethod.get(method) || 0) + 1
                );

                const statusGroup = Math.floor(req.response.status / 100) + 'xx';
                recording.stats.requestsByStatus.set(
                    statusGroup,
                    (recording.stats.requestsByStatus.get(statusGroup) || 0) + 1
                );
            }

            const durations = recording.requests.map(r => r.response.duration || 0);
            recording.stats.averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;

            await recording.save();

            return {
                message: 'HAR imported successfully',
                recordingId: recording._id,
                sessionId,
                name,
                requestCount: recording.requests.length
            };
        } catch (error) {
            throw new Error(`Failed to import HAR: ${error.message}`);
        }
    }

    /**
     * Emit recording event via Socket.IO
     */
    static emitRecordingEvent(eventName, data) {
        try {
            const io = getIO();
            if (io) {
                io.emit(eventName, {
                    ...data,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error emitting recording event:', error);
        }
    }
}

module.exports = TrafficRecorder;
