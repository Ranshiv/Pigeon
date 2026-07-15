// client/src/components/MockStateManager.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    FiRefreshCw, FiTrash2, FiPlus, FiEdit2, FiSave, FiX,
    FiHash, FiDatabase, FiClock, FiAlertCircle, FiEye
} from 'react-icons/fi';
import './MockStateManager.css';

const MockStateManager = ({ mockServerId, serverName }) => {
    const [state, setState] = useState({
        variables: {},
        counters: {},
        sessions: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingVar, setEditingVar] = useState(null);
    const [newVariable, setNewVariable] = useState({ key: '', value: '' });
    const [newCounter, setNewCounter] = useState({ name: '', value: 0 });
    const [showAddVariable, setShowAddVariable] = useState(false);
    const [showAddCounter, setShowAddCounter] = useState(false);

    const fetchState = useCallback(async () => {
        if (!mockServerId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/mock-servers/${mockServerId}/state`);

            if (!response.ok) throw new Error('Failed to fetch state');

            const data = await response.json();
            setState(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching state:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [mockServerId]);

    useEffect(() => {
        fetchState();
    }, [fetchState]);

    const resetAllState = async () => {
        if (!window.confirm('Are you sure you want to reset all state? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/reset`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to reset state');

            await fetchState();
        } catch (err) {
            console.error('Error resetting state:', err);
            setError(err.message);
        }
    };

    // Variable Management
    const addVariable = async () => {
        if (!newVariable.key.trim()) return;

        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/variables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    key: newVariable.key,
                    value: newVariable.value
                })
            });

            if (!response.ok) throw new Error('Failed to add variable');

            setNewVariable({ key: '', value: '' });
            setShowAddVariable(false);
            await fetchState();
        } catch (err) {
            console.error('Error adding variable:', err);
            setError(err.message);
        }
    };

    const updateVariable = async (key, value) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/variables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value })
            });

            if (!response.ok) throw new Error('Failed to update variable');

            setEditingVar(null);
            await fetchState();
        } catch (err) {
            console.error('Error updating variable:', err);
            setError(err.message);
        }
    };

    const deleteVariable = async (key) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/variables/${key}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete variable');

            await fetchState();
        } catch (err) {
            console.error('Error deleting variable:', err);
            setError(err.message);
        }
    };

    // Counter Management
    const addCounter = async () => {
        if (!newCounter.name.trim()) return;

        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/counters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: newCounter.name,
                    initialValue: newCounter.value
                })
            });

            if (!response.ok) throw new Error('Failed to add counter');

            setNewCounter({ name: '', value: 0 });
            setShowAddCounter(false);
            await fetchState();
        } catch (err) {
            console.error('Error adding counter:', err);
            setError(err.message);
        }
    };

    const incrementCounter = async (name, amount = 1) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/counters/${name}/increment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount })
            });

            if (!response.ok) throw new Error('Failed to increment counter');

            await fetchState();
        } catch (err) {
            console.error('Error incrementing counter:', err);
            setError(err.message);
        }
    };

    const resetCounter = async (name) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/counters/${name}/reset`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to reset counter');

            await fetchState();
        } catch (err) {
            console.error('Error resetting counter:', err);
            setError(err.message);
        }
    };

    const deleteCounter = async (name) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/counters/${name}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete counter');

            await fetchState();
        } catch (err) {
            console.error('Error deleting counter:', err);
            setError(err.message);
        }
    };

    // Session Management
    const clearSession = async (sessionId) => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to clear session');

            await fetchState();
        } catch (err) {
            console.error('Error clearing session:', err);
            setError(err.message);
        }
    };

    const clearAllSessions = async () => {
        if (!window.confirm('Clear all sessions?')) return;

        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/state/sessions`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to clear sessions');

            await fetchState();
        } catch (err) {
            console.error('Error clearing sessions:', err);
            setError(err.message);
        }
    };

    if (!mockServerId) {
        return (
            <div className="state-manager-empty">
                <FiDatabase size={48} />
                <h3>Select a Mock Server</h3>
                <p>Choose a mock server to manage its state</p>
            </div>
        );
    }

    return (
        <div className="state-manager">
            {/* Header */}
            <div className="state-header">
                <div className="header-title">
                    <h2>
                        <FiDatabase size={20} />
                        State Manager
                    </h2>
                    {serverName && <span className="server-name">{serverName}</span>}
                </div>
                <div className="header-actions">
                    <button
                        className="btn-icon-text"
                        onClick={fetchState}
                        disabled={isLoading}
                    >
                        <FiRefreshCw size={14} className={isLoading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    <button className="btn-danger" onClick={resetAllState}>
                        <FiTrash2 size={14} />
                        Reset All State
                    </button>
                </div>
            </div>

            {error && (
                <div className="state-error">
                    <FiAlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {isLoading && !state.variables ? (
                <div className="state-loading">
                    <div className="spinner"></div>
                    <p>Loading state...</p>
                </div>
            ) : (
                <div className="state-content">
                    {/* Variables Section */}
                    <div className="state-section">
                        <div className="section-header">
                            <h3>
                                <FiHash size={16} />
                                Variables
                            </h3>
                            <button
                                className="btn-add"
                                onClick={() => setShowAddVariable(true)}
                            >
                                <FiPlus size={14} />
                                Add Variable
                            </button>
                        </div>

                        {showAddVariable && (
                            <div className="add-form">
                                <input
                                    type="text"
                                    placeholder="Variable name"
                                    value={newVariable.key}
                                    onChange={(e) => setNewVariable(prev => ({ ...prev, key: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="Value"
                                    value={newVariable.value}
                                    onChange={(e) => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                                />
                                <button className="btn-save" onClick={addVariable}>
                                    <FiSave size={14} />
                                </button>
                                <button className="btn-cancel" onClick={() => setShowAddVariable(false)}>
                                    <FiX size={14} />
                                </button>
                            </div>
                        )}

                        <div className="items-list">
                            {Object.keys(state.variables || {}).length > 0 ? (
                                Object.entries(state.variables).map(([key, value]) => (
                                    <div key={key} className="state-item">
                                        <span className="item-key">{key}</span>
                                        {editingVar === key ? (
                                            <div className="edit-value">
                                                <input
                                                    type="text"
                                                    defaultValue={value}
                                                    id={`edit-var-${key}`}
                                                />
                                                <button
                                                    className="btn-save"
                                                    onClick={() => updateVariable(
                                                        key,
                                                        document.getElementById(`edit-var-${key}`).value
                                                    )}
                                                >
                                                    <FiSave size={12} />
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => setEditingVar(null)}
                                                >
                                                    <FiX size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="item-value">{String(value)}</span>
                                                <div className="item-actions">
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => setEditingVar(key)}
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                    <button
                                                        className="btn-icon danger"
                                                        onClick={() => deleteVariable(key)}
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="variables-empty" role="status" aria-live="polite">
                                    <div className="variables-empty-icon" aria-hidden="true">
                                        <FiHash size={28} />
                                    </div>
                                    <div className="variables-empty-content">
                                        <h4>No variables defined</h4>
                                        <p>
                                            Variables allow you to store dynamic values that can be used in your mock responses using <code>{'{'}{'{'} state.variableName {'}'}{'}'}</code> syntax.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Counters Section */}
                    <div className="state-section">
                        <div className="section-header">
                            <h3>
                                <FiHash size={16} />
                                Counters
                            </h3>
                            <button
                                className="btn-add"
                                onClick={() => setShowAddCounter(true)}
                            >
                                <FiPlus size={14} />
                                Add Counter
                            </button>
                        </div>

                        {showAddCounter && (
                            <div className="add-form">
                                <input
                                    type="text"
                                    placeholder="Counter name"
                                    value={newCounter.name}
                                    onChange={(e) => setNewCounter(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <input
                                    type="number"
                                    placeholder="Initial value"
                                    value={newCounter.value}
                                    onChange={(e) => setNewCounter(prev => ({ ...prev, value: parseInt(e.target.value) || 0 }))}
                                />
                                <button className="btn-save" onClick={addCounter}>
                                    <FiSave size={14} />
                                </button>
                                <button className="btn-cancel" onClick={() => setShowAddCounter(false)}>
                                    <FiX size={14} />
                                </button>
                            </div>
                        )}

                        <div className="items-list counters-list">
                            {Object.keys(state.counters || {}).length > 0 ? (
                                Object.entries(state.counters).map(([name, value]) => (
                                    <div key={name} className="counter-item">
                                        <div className="counter-info">
                                            <span className="counter-name">{name}</span>
                                            <span className="counter-value">{value}</span>
                                        </div>
                                        <div className="counter-actions">
                                            <button
                                                className="btn-counter"
                                                onClick={() => incrementCounter(name, -1)}
                                                title="Decrement"
                                            >
                                                -
                                            </button>
                                            <button
                                                className="btn-counter"
                                                onClick={() => incrementCounter(name, 1)}
                                                title="Increment"
                                            >
                                                +
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => resetCounter(name)}
                                                title="Reset"
                                            >
                                                <FiRefreshCw size={14} />
                                            </button>
                                            <button
                                                className="btn-icon danger"
                                                onClick={() => deleteCounter(name)}
                                                title="Delete"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="counters-empty" role="status" aria-live="polite">
                                    <div className="counters-empty-icon" aria-hidden="true">
                                        <FiHash size={28} />
                                    </div>
                                    <div className="counters-empty-content">
                                        <h4>No counters defined</h4>
                                        <p>
                                            Counters track numeric values that can be incremented, decremented, or reset. Access them in responses using <code>{'{'}{'{'} counter.counterName {'}'}{'}'}</code> syntax.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sessions Section */}
                    <div className="state-section">
                        <div className="section-header">
                            <h3>
                                <FiClock size={16} />
                                Active Sessions
                            </h3>
                            {state.sessions?.length > 0 && (
                                <button className="btn-danger-text" onClick={clearAllSessions}>
                                    Clear All Sessions
                                </button>
                            )}
                        </div>

                        <div className="sessions-list">
                            {state.sessions?.length > 0 ? (
                                state.sessions.map((session) => (
                                    <div key={session.sessionId} className="session-item">
                                        <div className="session-info">
                                            <span className="session-id">{session.sessionId}</span>
                                            <span className="session-created">
                                                Created: {new Date(session.createdAt).toLocaleString()}
                                            </span>
                                            <span className="session-expires">
                                                Expires: {new Date(session.expiresAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="session-data">
                                            {session.data && Object.keys(session.data).length > 0 ? (
                                                <pre>{JSON.stringify(session.data, null, 2)}</pre>
                                            ) : (
                                                <span className="no-data">No session data</span>
                                            )}
                                        </div>
                                        <button
                                            className="btn-icon danger"
                                            onClick={() => clearSession(session.sessionId)}
                                            title="Clear session"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="sessions-empty" role="status" aria-live="polite">
                                    <div className="sessions-empty-icon" aria-hidden="true">
                                        <FiEye size={28} />
                                    </div>
                                    <div className="sessions-empty-content">
                                        <h4>No active sessions</h4>
                                        <p>
                                            Session activity will show up here once your mock server handles
                                            authenticated requests that include session data.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Usage Guide */}
                    <div className="usage-guide">
                        <h4>Using State in Responses</h4>
                        <p>Access state values in your mock response bodies using these templates:</p>
                        <ul>
                            <li><code>{'{{state.variableName}}'}</code> - Get variable value</li>
                            <li><code>{'{{counter.counterName}}'}</code> - Get counter value</li>
                            <li><code>{'{{session.key}}'}</code> - Get session data</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MockStateManager;
