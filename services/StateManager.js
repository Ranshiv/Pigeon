// services/StateManager.js
const MockServer = require('../models/MockServer');
const { getIO } = require('../utils/socket/socket-server');

/**
 * StateManager Service
 * Manages stateful mock behavior including counters, variables, and sessions
 */
class StateManager {
    /**
     * Get current state for a mock server
     */
    static async getState(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state name');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return {
                counters: Object.fromEntries(mockServer.state?.counters || new Map()),
                variables: Object.fromEntries(mockServer.state?.variables || new Map()),
                sessions: mockServer.state?.sessions || [],
                lastResetAt: mockServer.state?.lastResetAt
            };
        } catch (error) {
            throw new Error(`Failed to get state: ${error.message}`);
        }
    }

    /**
     * Reset all state for a mock server
     */
    static async resetState(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            mockServer.state = {
                counters: new Map(),
                variables: new Map(),
                sessions: [],
                lastResetAt: new Date()
            };

            // Reset scenario sequential indices
            if (mockServer.scenarios) {
                mockServer.scenarios.forEach(scenario => {
                    scenario.sequentialIndex = 0;
                });
            }

            await mockServer.save();

            // Emit state update event
            this.emitStateUpdate(mockServerId, 'reset', mockServer.state);

            return {
                message: 'State reset successfully',
                lastResetAt: mockServer.state.lastResetAt
            };
        } catch (error) {
            throw new Error(`Failed to reset state: ${error.message}`);
        }
    }

    /**
     * Get a counter value
     */
    static async getCounter(mockServerId, counterName) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return mockServer.state?.counters?.get(counterName) || 0;
        } catch (error) {
            throw new Error(`Failed to get counter: ${error.message}`);
        }
    }

    /**
     * Set a counter value
     */
    static async setCounter(mockServerId, counterName, value) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.state) {
                mockServer.state = { counters: new Map(), variables: new Map(), sessions: [] };
            }
            if (!mockServer.state.counters) {
                mockServer.state.counters = new Map();
            }

            mockServer.state.counters.set(counterName, parseInt(value) || 0);
            await mockServer.save();

            this.emitStateUpdate(mockServerId, 'counter:set', { counterName, value });

            return {
                counterName,
                value: mockServer.state.counters.get(counterName)
            };
        } catch (error) {
            throw new Error(`Failed to set counter: ${error.message}`);
        }
    }

    /**
     * Increment a counter
     */
    static async incrementCounter(mockServerId, counterName, amount = 1) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.state) {
                mockServer.state = { counters: new Map(), variables: new Map(), sessions: [] };
            }
            if (!mockServer.state.counters) {
                mockServer.state.counters = new Map();
            }

            const currentValue = mockServer.state.counters.get(counterName) || 0;
            const newValue = currentValue + (parseInt(amount) || 1);
            mockServer.state.counters.set(counterName, newValue);
            await mockServer.save();

            this.emitStateUpdate(mockServerId, 'counter:incremented', { counterName, value: newValue });

            return {
                counterName,
                previousValue: currentValue,
                value: newValue
            };
        } catch (error) {
            throw new Error(`Failed to increment counter: ${error.message}`);
        }
    }

    /**
     * Decrement a counter
     */
    static async decrementCounter(mockServerId, counterName, amount = 1) {
        return this.incrementCounter(mockServerId, counterName, -(parseInt(amount) || 1));
    }

    /**
     * Reset a counter to zero
     */
    static async resetCounter(mockServerId, counterName) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.state) {
                mockServer.state = { counters: new Map(), variables: new Map(), sessions: [] };
            }
            if (!mockServer.state.counters) {
                mockServer.state.counters = new Map();
            }

            const previousValue = mockServer.state.counters.get(counterName) || 0;
            mockServer.state.counters.set(counterName, 0);
            await mockServer.save();

            this.emitStateUpdate(mockServerId, 'counter:reset', { counterName, previousValue });

            return {
                counterName,
                previousValue,
                value: 0
            };
        } catch (error) {
            throw new Error(`Failed to reset counter: ${error.message}`);
        }
    }

    /**
     * Delete a counter
     */
    static async deleteCounter(mockServerId, counterName) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (mockServer.state?.counters) {
                mockServer.state.counters.delete(counterName);
                await mockServer.save();
            }

            this.emitStateUpdate(mockServerId, 'counter:deleted', { counterName });

            return { message: `Counter '${counterName}' deleted` };
        } catch (error) {
            throw new Error(`Failed to delete counter: ${error.message}`);
        }
    }

    /**
     * Get all counters
     */
    static async getAllCounters(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state.counters');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return Object.fromEntries(mockServer.state?.counters || new Map());
        } catch (error) {
            throw new Error(`Failed to get counters: ${error.message}`);
        }
    }

    /**
     * Get a variable value
     */
    static async getVariable(mockServerId, variableName) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return mockServer.state?.variables?.get(variableName);
        } catch (error) {
            throw new Error(`Failed to get variable: ${error.message}`);
        }
    }

    /**
     * Set a variable value
     */
    static async setVariable(mockServerId, variableName, value) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.state) {
                mockServer.state = { counters: new Map(), variables: new Map(), sessions: [] };
            }
            if (!mockServer.state.variables) {
                mockServer.state.variables = new Map();
            }

            mockServer.state.variables.set(variableName, value);
            await mockServer.save();

            this.emitStateUpdate(mockServerId, 'variable:set', { variableName, value });

            return {
                variableName,
                value
            };
        } catch (error) {
            throw new Error(`Failed to set variable: ${error.message}`);
        }
    }

    /**
     * Delete a variable
     */
    static async deleteVariable(mockServerId, variableName) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (mockServer.state?.variables) {
                mockServer.state.variables.delete(variableName);
                await mockServer.save();
            }

            this.emitStateUpdate(mockServerId, 'variable:deleted', { variableName });

            return { message: `Variable '${variableName}' deleted` };
        } catch (error) {
            throw new Error(`Failed to delete variable: ${error.message}`);
        }
    }

    /**
     * Get all variables
     */
    static async getAllVariables(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state.variables');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return Object.fromEntries(mockServer.state?.variables || new Map());
        } catch (error) {
            throw new Error(`Failed to get variables: ${error.message}`);
        }
    }

    /**
     * Create or update a session
     */
    static async setSession(mockServerId, sessionId, data, ttlMinutes = 60) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.state) {
                mockServer.state = { counters: new Map(), variables: new Map(), sessions: [] };
            }
            if (!mockServer.state.sessions) {
                mockServer.state.sessions = [];
            }

            const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

            // Find existing session or create new one
            const existingIndex = mockServer.state.sessions.findIndex(s => s.sessionId === sessionId);

            if (existingIndex >= 0) {
                mockServer.state.sessions[existingIndex] = {
                    sessionId,
                    data,
                    createdAt: mockServer.state.sessions[existingIndex].createdAt,
                    expiresAt
                };
            } else {
                mockServer.state.sessions.push({
                    sessionId,
                    data,
                    createdAt: new Date(),
                    expiresAt
                });
            }

            await mockServer.save();

            this.emitStateUpdate(mockServerId, 'session:updated', { sessionId });

            return {
                sessionId,
                data,
                expiresAt
            };
        } catch (error) {
            throw new Error(`Failed to set session: ${error.message}`);
        }
    }

    /**
     * Get a session by ID
     */
    static async getSession(mockServerId, sessionId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state.sessions');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const session = mockServer.state?.sessions?.find(s => s.sessionId === sessionId);

            if (!session) {
                return null;
            }

            // Check if session is expired
            if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                return null;
            }

            return session;
        } catch (error) {
            throw new Error(`Failed to get session: ${error.message}`);
        }
    }

    /**
     * Delete a session
     */
    static async deleteSession(mockServerId, sessionId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (mockServer.state?.sessions) {
                mockServer.state.sessions = mockServer.state.sessions.filter(
                    s => s.sessionId !== sessionId
                );
                await mockServer.save();
            }

            this.emitStateUpdate(mockServerId, 'session:deleted', { sessionId });

            return { message: `Session '${sessionId}' deleted` };
        } catch (error) {
            throw new Error(`Failed to delete session: ${error.message}`);
        }
    }

    /**
     * Get all sessions (excluding expired)
     */
    static async getAllSessions(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId).select('state.sessions');
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const now = new Date();
            return (mockServer.state?.sessions || []).filter(
                s => !s.expiresAt || new Date(s.expiresAt) > now
            );
        } catch (error) {
            throw new Error(`Failed to get sessions: ${error.message}`);
        }
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);
            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const now = new Date();
            const before = mockServer.state?.sessions?.length || 0;

            if (mockServer.state?.sessions) {
                mockServer.state.sessions = mockServer.state.sessions.filter(
                    s => !s.expiresAt || new Date(s.expiresAt) > now
                );
                await mockServer.save();
            }

            const after = mockServer.state?.sessions?.length || 0;
            const removed = before - after;

            return {
                message: `Cleaned up ${removed} expired sessions`,
                removedCount: removed,
                remainingCount: after
            };
        } catch (error) {
            throw new Error(`Failed to cleanup sessions: ${error.message}`);
        }
    }

    /**
     * Emit state update via Socket.IO
     */
    static emitStateUpdate(mockServerId, action, data) {
        try {
            const io = getIO();
            if (io) {
                io.emit('mock:state:updated', {
                    mockServerId,
                    action,
                    data,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error emitting state update:', error);
        }
    }
}

module.exports = StateManager;
