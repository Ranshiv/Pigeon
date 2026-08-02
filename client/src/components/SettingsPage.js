import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
    FiBell,
    FiCalendar,
    FiCheck,
    FiChevronRight,
    FiLogOut,
    FiMail,
    FiMoon,
    FiSun,
    FiUser,
    FiZap
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { useFont, fontSizeOptions } from '../context/FontContext';
import AppSelect from './common/AppSelect/AppSelect';
import './SettingsPage.css';

const availableIcons = [
    'buffalo.png', 'clown-fish.png', 'hippo.png',
    'lion.png', 'mouse.png', 'pig.png', 'sheep.png'
];

const defaultNotificationPreferences = {
    inAppEnabled: true,
    workspaceActivity: true,
    mergeRequests: true,
    monitoring: true,
    systemFailures: true
};

const notificationOptions = [
    { key: 'workspaceActivity', label: 'Workspace activity', description: 'Changes and actions from other workspace members.' },
    { key: 'mergeRequests', label: 'Merge requests', description: 'New, approved, rejected, or rolled-back merge requests.' },
    { key: 'monitoring', label: 'Monitoring', description: 'Monitor status transitions and incident updates.' },
    { key: 'systemFailures', label: 'API and system failures', description: 'Failed requests, invalid actions, and service errors.' }
];

const themeCatalog = [
    { value: 'light', label: 'Light', description: 'A bright, focused workspace.', className: 'theme-preview-light', icon: FiSun },
    { value: 'dark', label: 'Dark', description: 'Deep blue contrast for low light.', className: 'theme-preview-dark', icon: FiMoon },
    { value: 'omni', label: 'Omni', description: 'Black and orange, built for intensity.', className: 'theme-preview-omni', icon: FiZap },
    { value: 'black', label: 'Black', description: 'Pure black and white for focused contrast.', className: 'theme-preview-black', icon: FiMoon }
];

const settingsSections = [
    { id: 'profile', label: 'Profile', description: 'Your identity', icon: FiUser },
    { id: 'appearance', label: 'Appearance', description: 'Theme and text', icon: FiSun },
    { id: 'notifications', label: 'Notifications', description: 'What reaches you', icon: FiBell },
    { id: 'account', label: 'Account', description: 'Sign-in details', icon: FiZap }
];

const SettingsPage = () => {
    const { theme, setTheme } = useTheme();
    const { fontSize, setFontSize } = useFont();
    const [currentUser, setCurrentUser] = useState(null);
    const [newUsername, setNewUsername] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(null);
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedFontSize, setSelectedFontSize] = useState(fontSize);
    const [notificationPreferences, setNotificationPreferences] = useState(defaultNotificationPreferences);
    const { section, '*': sectionRemainder } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        const fetchUserData = async () => {
            setIsUserDataLoading(true);
            try {
                const res = await fetch('/api/auth/check', { credentials: 'include' });
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok || !data.isAuthenticated || !data.user) {
                    setMessage('Your session has expired. Please sign in again.');
                    return;
                }

                const user = data.user;
                // New accounts and accounts without an explicit preference use
                // the same Omni baseline as the public home page.
                // A locally selected theme takes precedence when a profile
                // save was interrupted, so a reload does not undo the choice.
                const hasLocalThemeSelection = localStorage.getItem('theme-user-selected') === 'true';
                const userTheme = hasLocalThemeSelection ? theme : (user.theme || 'omni');
                const userFontSize = user.fontSize || fontSizeOptions.Medium;
                const preferences = { ...defaultNotificationPreferences, ...(user.notificationPreferences || {}) };
                setCurrentUser(user);
                setNewUsername(user.displayName || '');
                setSelectedIcon(user.profileIcon || null);
                setNotificationPreferences(preferences);
                setSelectedFontSize(userFontSize);

                if (userTheme !== theme) setTheme(userTheme);
                if (userFontSize !== fontSize) setFontSize(userFontSize);
                localStorage.setItem('user', JSON.stringify({
                    id: user._id || user.id,
                    displayName: user.displayName || 'User',
                    email: user.email,
                    profileIcon: user.profileIcon,
                    notificationPreferences: preferences
                }));
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching user data:', err);
                    setMessage('Unable to load settings. Please try again.');
                }
            } finally {
                if (!cancelled) setIsUserDataLoading(false);
            }
        };
        fetchUserData();
        return () => { cancelled = true; };
        // Theme/font are intentionally read once while hydrating the account.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => setSelectedFontSize(fontSize), [fontSize]);

    const handleProfileUpdate = async (updateData, { showError = true } = {}) => {
        setMessage('');
        if (!currentUser) return false;
        try {
            const res = await fetch('/api/auth/user/profile', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (showError) {
                    setMessage(`Error updating profile: ${data.message || 'Request failed'}`);
                }
                return false;
            }

            const updatedUser = data.user || { ...currentUser, ...updateData };
            setCurrentUser(updatedUser);
            if (updatedUser.notificationPreferences) {
                const preferences = { ...defaultNotificationPreferences, ...updatedUser.notificationPreferences };
                setNotificationPreferences(preferences);
                window.dispatchEvent(new CustomEvent('notification-preferences-updated', { detail: preferences }));
            }
            const existingUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...existingUser, ...updatedUser, id: updatedUser._id || updatedUser.id }));
            return true;
        } catch (err) {
            console.error('Error updating profile:', err);
            if (showError) {
                setMessage('Failed to update profile due to a network or server error.');
            }
            return false;
        }
    };

    const handleUsernameSubmit = async (event) => {
        event.preventDefault();
        const displayName = newUsername.trim();
        if (!currentUser || !displayName || displayName === currentUser.displayName) {
            setMessage('Enter a different display name to save.');
            return;
        }
        setIsUsernameLoading(true);
        if (await handleProfileUpdate({ displayName })) setMessage('Display name updated.');
        setIsUsernameLoading(false);
    };

    const handleThemeChange = async (newTheme) => {
        if (newTheme === theme) return;
        setTheme(newTheme);
        const selectedTheme = themeCatalog.find((option) => option.value === newTheme);
        const saved = await handleProfileUpdate({ theme: newTheme }, { showError: false });
        if (saved) {
            setMessage(`${selectedTheme?.label || 'Theme'} theme enabled.`);
        } else {
            // ThemeContext already persists the selection locally. Keep the
            // visual change even when the profile API is temporarily down.
            setMessage(`${selectedTheme?.label || 'Theme'} theme enabled locally. Sign in to sync it to your account.`);
        }
    };

    const handleFontSizeChange = async (newSize) => {
        setSelectedFontSize(newSize);
        setFontSize(newSize);
        if (await handleProfileUpdate({ fontSize: newSize })) setMessage('Font size updated.');
    };

    const handleIconSelect = async (iconFilename) => {
        if (selectedIcon === iconFilename) return;
        const previous = selectedIcon;
        setSelectedIcon(iconFilename);
        if (await handleProfileUpdate({ profileIcon: iconFilename })) setMessage('Profile avatar updated.');
        else setSelectedIcon(previous);
    };

    const updateNotificationPreference = async (key, value) => {
        const previous = notificationPreferences;
        const next = { ...notificationPreferences, [key]: value };
        setNotificationPreferences(next);
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', { detail: next }));
        const success = await handleProfileUpdate({ notificationPreferences: { [key]: value } });
        if (success) {
            setMessage('Notification preferences updated.');
        } else {
            setNotificationPreferences(previous);
            window.dispatchEvent(new CustomEvent('notification-preferences-updated', { detail: previous }));
        }
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await fetch('/api/auth/logout', { credentials: 'include' });
        } finally {
            localStorage.removeItem('user');
            window.location.assign('/');
        }
    };

    const memberSince = useMemo(() => {
        if (!currentUser?.createdAt) return 'Recently';
        return new Date(currentUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }, [currentUser]);

    const validSection = !sectionRemainder && settingsSections.some((item) => item.id === section);
    const activeSection = validSection ? section : 'profile';

    useEffect(() => {
        if (section && !validSection) {
            navigate('/workspace/settings/profile', { replace: true });
        }
    }, [navigate, section, validSection]);

    if (isUserDataLoading) {
        return <div className="settings-page settings-page--loading"><div className="settings-loading-card">Loading your settings…</div></div>;
    }

    if (!currentUser) {
        return <div className="settings-page settings-page--loading"><div className="settings-loading-card">{message || 'Unable to load your settings.'}</div></div>;
    }

    return (
        <main className="settings-page">
            <header className="settings-hero">
                <div>
                    <p className="settings-eyebrow">Personal account</p>
                    <h1>Settings</h1>
                    <p className="settings-intro">Shape how Pigeon looks, feels, and keeps you informed.</p>
                </div>
                <div className="settings-account-chip">
                    <span className="settings-account-avatar">
                        {selectedIcon ? <img src={`/assets/icons/${selectedIcon}`} alt="" /> : <FiUser aria-hidden="true" />}
                    </span>
                    <span><strong>{currentUser.displayName}</strong><small>{currentUser.email}</small></span>
                </div>
            </header>

            {message && <div className={`settings-message ${message.startsWith('Error') || message.startsWith('Failed') || message.startsWith('Unable') ? 'error' : 'success'}`} role="status">{message}</div>}

            <div className="settings-layout">
                <nav className="settings-nav" aria-label="Settings sections">
                    {settingsSections.map(({ id, label, description, icon: Icon }) => (
                        <NavLink
                            key={id}
                            to={`/workspace/settings/${id}`}
                            end
                            className={({ isActive }) => `settings-nav-link${isActive ? ' active' : ''}`}
                        >
                            <Icon aria-hidden="true" />
                            <span><strong>{label}</strong><small>{description}</small></span>
                            <FiChevronRight aria-hidden="true" className="settings-nav-arrow" />
                        </NavLink>
                    ))}
                </nav>

                <div className="settings-content">
                    {activeSection === 'profile' && <section className="settings-card" id="profile">
                        <div className="settings-card-heading"><div><p className="settings-eyebrow">Identity</p><h2>Profile</h2></div><FiUser aria-hidden="true" /></div>
                        <p className="settings-card-description">Keep your display name and avatar recognizable across workspaces.</p>
                        <form className="settings-profile-form" onSubmit={handleUsernameSubmit}>
                            <label htmlFor="settings-display-name">Display name</label>
                            <div className="settings-input-row">
                                <input id="settings-display-name" type="text" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} maxLength={80} required disabled={isUsernameLoading} />
                                <button className="settings-primary-button" type="submit" disabled={isUsernameLoading || !newUsername.trim() || newUsername.trim() === currentUser.displayName}>{isUsernameLoading ? 'Saving…' : 'Save changes'}</button>
                            </div>
                        </form>
                        <div className="settings-field-block">
                            <label>Avatar</label>
                            <div className="settings-avatar-grid" role="list" aria-label="Choose a profile avatar">
                                {availableIcons.map((iconFile) => (
                                    <button type="button" key={iconFile} className={`settings-avatar-option${selectedIcon === iconFile ? ' selected' : ''}`} onClick={() => handleIconSelect(iconFile)} aria-label={`Choose ${iconFile.split('.')[0]} avatar`} aria-pressed={selectedIcon === iconFile}>
                                        <img src={`/assets/icons/${iconFile}`} alt="" />
                                        {selectedIcon === iconFile && <span><FiCheck aria-hidden="true" /></span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>}

                    {activeSection === 'appearance' && <section className="settings-card" id="appearance">
                        <div className="settings-card-heading"><div><p className="settings-eyebrow">Interface</p><h2>Appearance</h2></div>{theme === 'light' ? <FiSun aria-hidden="true" /> : theme === 'omni' ? <FiZap aria-hidden="true" /> : <FiMoon aria-hidden="true" />}</div>
                        <p className="settings-card-description">Tune the workspace interface to match your environment.</p>
                        <div className="settings-theme-catalog" role="radiogroup" aria-label="Color theme">
                            {themeCatalog.map(({ value, label, description, className: previewClass, icon: Icon }) => (
                                <button
                                    type="button"
                                    key={value}
                                    className={`settings-theme-option${theme === value ? ' selected' : ''}`}
                                    role="radio"
                                    aria-checked={theme === value}
                                    onClick={() => handleThemeChange(value)}
                                >
                                    <span className={`settings-theme-preview ${previewClass}`} aria-hidden="true"><Icon /></span>
                                    <span className="settings-theme-option-copy"><strong>{label}</strong><small>{description}</small></span>
                                    {theme === value && <span className="settings-theme-check"><FiCheck aria-hidden="true" /></span>}
                                </button>
                            ))}
                        </div>
                        <div className="settings-preference-row settings-preference-row--select">
                            <div className="settings-preference-icon"><span className="settings-type-icon">Aa</span></div>
                            <div className="settings-preference-copy"><strong>Text size</strong><span>Choose a comfortable reading size.</span></div>
                            <AppSelect id="fontSizeSelect" value={selectedFontSize} onChange={handleFontSizeChange} options={Object.entries(fontSizeOptions).map(([label, value]) => ({ label: `${label} · ${value}`, value }))} className="settings-font-select" />
                        </div>
                    </section>}

                    {activeSection === 'notifications' && <section className="settings-card" id="notifications">
                        <div className="settings-card-heading"><div><p className="settings-eyebrow">Stay in the loop</p><h2>Notifications</h2></div><FiBell aria-hidden="true" /></div>
                        <p className="settings-card-description">Choose which events appear in your in-app notification center. Changes apply instantly.</p>
                        <div className="settings-master-row">
                            <div><strong>In-app notifications</strong><span>Show alerts in the notification bell.</span></div>
                            <button type="button" className={`settings-switch${notificationPreferences.inAppEnabled ? ' on' : ''}`} role="switch" aria-checked={notificationPreferences.inAppEnabled} onClick={() => updateNotificationPreference('inAppEnabled', !notificationPreferences.inAppEnabled)}><span /></button>
                        </div>
                        <div className={`settings-notification-list${notificationPreferences.inAppEnabled ? '' : ' disabled'}`}>
                            {notificationOptions.map(({ key, label, description }) => (
                                <div className="settings-notification-row" key={key}>
                                    <div><strong>{label}</strong><span>{description}</span></div>
                                    <button type="button" className={`settings-switch${notificationPreferences[key] && notificationPreferences.inAppEnabled ? ' on' : ''}`} role="switch" aria-checked={Boolean(notificationPreferences[key] && notificationPreferences.inAppEnabled)} disabled={!notificationPreferences.inAppEnabled} onClick={() => updateNotificationPreference(key, !notificationPreferences[key])}><span /></button>
                                </div>
                            ))}
                        </div>
                    </section>}

                    {activeSection === 'account' && <section className="settings-card" id="account">
                        <div className="settings-card-heading"><div><p className="settings-eyebrow">Access</p><h2>Account</h2></div><FiZap aria-hidden="true" /></div>
                        <p className="settings-card-description">Your account is secured through Google. Pigeon does not store a separate password.</p>
                        <div className="settings-account-details">
                            <div><FiMail aria-hidden="true" /><span><small>Email</small><strong>{currentUser.email}</strong></span></div>
                            <div><FiCalendar aria-hidden="true" /><span><small>Member since</small><strong>{memberSince}</strong></span></div>
                            <div><FiCheck aria-hidden="true" /><span><small>Sign-in provider</small><strong>Google connected</strong></span></div>
                        </div>
                        <div className="settings-signout-row"><div><strong>Sign out of Pigeon</strong><span>End this browser session on this device.</span></div><button type="button" className="settings-danger-button" onClick={handleSignOut} disabled={isSigningOut}><FiLogOut aria-hidden="true" />{isSigningOut ? 'Signing out…' : 'Sign out'}</button></div>
                    </section>}
                </div>
            </div>
        </main>
    );
};

export default SettingsPage;
