// src/components/SettingsPage.js
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import './SettingsPage.css';

const SettingsPage = () => {
    const { theme, toggleTheme } = useTheme();
    const [currentUser, setCurrentUser] = useState(null);
    const [newUsername, setNewUsername] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState(''); // For success/error messages

    useEffect(() => {
        // Fetch current user data when the component mounts
        const fetchUserData = async () => {
            setIsLoading(true);
            setMessage('');
            try {
                const res = await fetch('/api/auth/check'); // Use your auth check endpoint
                if (res.ok) {
                    const data = await res.json();
                    if (data.isAuthenticated) {
                        setCurrentUser(data.user);
                        setNewUsername(data.user.displayName); // Pre-fill the input
                    } else {
                        // Handle case where user is somehow not authenticated
                        setMessage('Error: Not authenticated.');
                    }
                } else {
                    throw new Error('Failed to fetch user data');
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
                setMessage('Error fetching user data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        setMessage(''); // Clear previous messages
        if (!currentUser || newUsername === currentUser.displayName) {
            setMessage("Username is the same or user data not loaded.");
            return;
        }

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: newUsername }),
            });

            if (res.ok) {
                const data = await res.json();
                setCurrentUser(data.user); // Update local user state
                setMessage('Username updated successfully!');
            } else {
                const errorData = await res.json();
                setMessage(`Error updating username: ${errorData.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Error updating username:", err);
            setMessage('Failed to update username.');
        }
    };

    const handleThemeChange = () => {
        toggleTheme();
        // Call backend to update theme preference
        updateThemePreference(theme === 'light' ? 'dark' : 'light');
    };

    const updateThemePreference = async (newTheme) => {
        if (!currentUser) return;
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                console.error(`Error updating theme: ${errorData.message || 'Unknown error'}`)
            }
            // Optionally update local user state if backend returns updated user
            // const data = await res.json();
            // setCurrentUser(data.user);
        } catch (err) {
            console.error("Error updating theme preference:", err);
        }
    };


    if (isLoading) {
        return <div>Loading settings...</div>;
    }

    if (!currentUser) {
        return <div>Error loading user data or not authenticated.</div>;
    }

    return (
        <div className="settings-page">
            <h1>Settings</h1>

            {message && <p className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</p>}

            <section className="setting-section">
                <h2>Profile</h2>
                <form onSubmit={handleUsernameSubmit}>
                    <label htmlFor="username">Display Name:</label>
                    <input
                        type="text"
                        id="username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={newUsername === currentUser.displayName}>
                        Save Username
                    </button>
                </form>
                <p>Email: {currentUser.email} (Cannot be changed)</p>
            </section>

            <section className="setting-section">
                <h2>Appearance</h2>
                <label htmlFor="theme-toggle">Theme:</label>
                <button id="theme-toggle" onClick={handleThemeChange}>
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </button>
            </section>

            <section className="setting-section">
                <h2>Other Settings</h2>
                <p>(Placeholder for future settings like API Key management, etc.)</p>
            </section>
        </div>
    );
};

export default SettingsPage;