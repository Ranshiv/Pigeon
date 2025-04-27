// src/components/SettingsPage.js (Modified)
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useFont, fontSizeOptions } from '../context/FontContext';
import './SettingsPage.css';

// Define available icons (matches filenames in public/assets/icons)
const availableIcons = [
    'buffalo.png', 'clown-fish.png', 'hippo.png',
    'lion.png', 'mouse.png', 'pig.png', 'sheep.png'
];

const SettingsPage = () => {
    const { theme, toggleTheme } = useTheme();
    const { fontSize, setFontSize } = useFont();

    const [currentUser, setCurrentUser] = useState(null);
    const [newUsername, setNewUsername] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(null); // State for selected icon filename
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true);
    const [message, setMessage] = useState('');
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
                        setSelectedIcon(data.user.profileIcon); // Initialize selected icon

                        const userTheme = data.user.theme || 'light';
                        const userFontSize = data.user.fontSize || fontSizeOptions['Medium'];

                        if (userTheme !== localStorage.getItem('theme')) {
                            localStorage.setItem('theme', userTheme);
                            document.body.className = userTheme + '-theme';
                        }
                        if (userFontSize !== fontSize) {
                            setFontSize(userFontSize);
                        }
                        setSelectedFontSize(userFontSize);

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

    useEffect(() => {
        setSelectedFontSize(fontSize);
    }, [fontSize]);

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
                setCurrentUser(data.user); // Update user state with the response

                // Update user data in localStorage to ensure it's available for collaborator display
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({
                    ...userData,
                    ...updateData,
                    displayName: updateData.displayName || userData.displayName || currentUser.displayName
                }));

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

    const handleThemeChange = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        toggleTheme();
        handleProfileUpdate({ theme: newTheme });
    };

    const handleFontSizeChange = async (e) => {
        const newSize = e.target.value;
        setSelectedFontSize(newSize);
        setFontSize(newSize);
        await handleProfileUpdate({ fontSize: newSize });
        setMessage('Font size updated.');
    };

    // --- New Handler for Icon Selection ---
    const handleIconSelect = async (iconFilename) => {
        if (selectedIcon === iconFilename) return; // No change

        setSelectedIcon(iconFilename); // Update local state immediately
        const success = await handleProfileUpdate({ profileIcon: iconFilename }); // Update backend
        if (success) {
            setMessage('Profile icon updated successfully!');
        } else {
            // Revert local state if backend update failed (optional)
            // setSelectedIcon(currentUser?.profileIcon || null);
        }
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

            {/* Profile Section */}
            <section className="setting-section">
                <h2>Profile</h2>
                {/* Username Form */}
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

                {/* --- Icon Selection --- */}
                <div className="form-group icon-selection">
                    <label>Profile Icon:</label>
                    <div className="icon-grid">
                        {availableIcons.map(iconFile => (
                            <img
                                key={iconFile}
                                src={`/assets/icons/${iconFile}`} // Path relative to public folder
                                alt={iconFile.split('.')[0]} // Alt text from filename
                                className={`profile-icon-option ${selectedIcon === iconFile ? 'selected' : ''}`}
                                onClick={() => handleIconSelect(iconFile)}
                                title={`Select ${iconFile.split('.')[0]}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Appearance Section */}
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
                {/* Font Size Selection */}
                <div className="form-group">
                    <label htmlFor="fontSizeSelect">Font Size:</label>
                    <select
                        id="fontSizeSelect"
                        value={selectedFontSize}
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

            {/* Other Settings Section */}
            <section className="setting-section">
                <h2>Other Settings</h2>
                <p>(Placeholder for future settings)</p>
            </section>
        </div>
    );
};

export default SettingsPage;