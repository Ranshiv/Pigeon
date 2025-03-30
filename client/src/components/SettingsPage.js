// src/components/SettingsPage.js (Simplified)
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useFont, fontSizeOptions } from '../context/FontContext'; // Import only fontSize related things
import './SettingsPage.css';

const SettingsPage = () => {
    const { theme, toggleTheme } = useTheme();
    const { fontSize, setFontSize } = useFont(); // Use only fontSize context

    const [currentUser, setCurrentUser] = useState(null);
    const [newUsername, setNewUsername] = useState('');
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true);
    const [message, setMessage] = useState('');
    // Keep only local state for font size dropdown
    const [selectedFontSize, setSelectedFontSize] = useState(fontSize);

    useEffect(() => {
        const fetchUserData = async () => {
            setIsUserDataLoading(true);
            setMessage('');
            try {
                const res = await fetch('/api/auth/check');
                if (res.ok) {
                    const data = await res.json();
                    if (data.isAuthenticated) {
                        setCurrentUser(data.user);
                        setNewUsername(data.user.displayName);

                        // --- Initialize theme and font size from fetched user data ---
                        const userTheme = data.user.theme || 'light';
                        const userFontSize = data.user.fontSize || fontSizeOptions['Medium'];

                        if (userTheme !== localStorage.getItem('theme')) {
                            localStorage.setItem('theme', userTheme);
                            document.body.className = userTheme + '-theme';
                        }

                        // Apply font size if different
                        if (userFontSize !== fontSize) {
                            setFontSize(userFontSize); // Update context
                        }
                        setSelectedFontSize(userFontSize); // Update local dropdown state

                    } else {
                        setMessage('Error: Not authenticated.');
                    }
                } else {
                    throw new Error('Failed to fetch user data');
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
                setMessage('Error fetching user data.');
            } finally {
                setIsUserDataLoading(false);
            }
        };
        fetchUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update local dropdown state when context changes
    useEffect(() => {
        setSelectedFontSize(fontSize);
    }, [fontSize]);


    // Generic profile update function
    const handleProfileUpdate = async (updateData) => {
        setMessage('');
        if (!currentUser) return false;
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentUser(data.user);
                return true;
            } else {
                const errorData = await res.json();
                setMessage(`Error updating profile: ${errorData.message || 'Request failed'}`);
                return false;
            }
        } catch (err) {
            console.error("Error updating profile:", err);
            setMessage('Failed to update profile due to a network or server error.');
            return false;
        }
    };

    // Username submit handler remains the same conceptually
    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser || newUsername.trim() === '' || newUsername.trim() === currentUser.displayName) {
            setMessage("Please enter a new, valid username different from the current one.");
            return;
        }
        setIsUsernameLoading(true);
        const success = await handleProfileUpdate({ displayName: newUsername.trim() });
        if (success) {
            setMessage('Username updated successfully!');
        }
        setIsUsernameLoading(false);
    };

    // Theme change handler remains the same conceptually
    const handleThemeChange = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        toggleTheme();
        handleProfileUpdate({ theme: newTheme });
    };

    // Font size change handler
    const handleFontSizeChange = async (e) => {
        const newSize = e.target.value;
        setSelectedFontSize(newSize); // Update local state first
        setFontSize(newSize); // Update context & localStorage
        await handleProfileUpdate({ fontSize: newSize }); // Update backend
        setMessage('Font size updated.');
    };


    if (isUserDataLoading) {
        return <div>Loading settings...</div>;
    }

    if (!currentUser) {
        return <div>Error loading user data or not authenticated.</div>;
    }

    return (
        <div className="settings-page">
            <h1>Settings</h1>

            {message && <p className={`message ${message.startsWith('Error') || message.startsWith('Failed') ? 'error' : 'success'}`}>{message}</p>}

            <section className="setting-section">
                <h2>Profile</h2>
                <form onSubmit={handleUsernameSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Display Name:</label>
                        <input
                            type="text"
                            id="username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            required
                            disabled={isUsernameLoading}
                        />
                    </div>
                    <button type="submit" disabled={isUsernameLoading || !newUsername.trim() || newUsername.trim() === currentUser.displayName}>
                        {isUsernameLoading ? 'Saving...' : 'Save Username'}
                    </button>
                </form>
                <p>Email: {currentUser.email} (Cannot be changed via settings)</p>
            </section>

            <section className="setting-section">
                <h2>Appearance</h2>
                {/* Theme Toggle */}
                <div className="form-group">
                    <label>Theme:</label>
                    <div>
                        <button id="theme-toggle" onClick={handleThemeChange}>
                            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                        </button>
                        <span style={{ marginLeft: '10px' }}>(Current: {theme})</span>
                    </div>
                </div>

                {/* REMOVE Font Family Selection */}

                {/* Font Size Selection */}
                <div className="form-group">
                    <label htmlFor="fontSizeSelect">Font Size:</label>
                    <select
                        id="fontSizeSelect"
                        value={selectedFontSize} // Use local state
                        onChange={handleFontSizeChange}
                    >
                        {Object.entries(fontSizeOptions).map(([label, value]) => (
                            <option key={value} value={value}>
                                {label} ({value})
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            <section className="setting-section">
                <h2>Other Settings</h2>
                <p>(Placeholder for future settings)</p>
            </section>
        </div>
    );
};

export default SettingsPage;