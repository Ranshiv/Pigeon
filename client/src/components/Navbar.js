// client/src/components/Navbar.js (Modified)
import React, { useState } from 'react'; // Import useState
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSettings, FiUser, FiLogOut } from 'react-icons/fi'; // Example icons from Feather Icons

const Navbar = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false); // State for profile dropdown

    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        // Ensure settings path is checked correctly
        if (path === '/workspace/settings') {
            return location.pathname === path;
        }
        if (path.startsWith('/workspace')) {
            return location.pathname.startsWith(path);
        }
        return location.pathname === path;
    };

    const handleLogout = async () => {
        setShowProfileMenu(false); // Close menu on logout
        try {
            const response = await fetch('/api/auth/logout');
            if (response.ok) {
                window.location.href = '/';
            } else {
                console.error('Logout failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                Pigeon
            </div>
            <div className="navbar-links">
                {isAuthenticated ? (
                    <>
                        {/* Main navigation links */}
                        <span
                            onClick={() => navigate('/workspace/home')}
                            className={`nav-item ${isActive('/workspace/home') ? 'active' : ''}`}
                            title="Home" // Add tooltips for icons
                        >
                            Home
                        </span>
                        <span
                            onClick={() => navigate('/workspace/workspaces')}
                            className={`nav-item ${isActive('/workspace/workspaces') ? 'active' : ''}`}
                            title="Workspaces"
                        >
                            Workspaces
                        </span>
                        <span
                            onClick={() => navigate('/workspace/api-network')}
                            className={`nav-item ${isActive('/workspace/api-network') ? 'active' : ''}`}
                            title="API Network"
                        >
                            API Network
                        </span>

                        {/* Icons on the right */}
                        <div className="navbar-icons">
                            <span
                                onClick={() => navigate('/workspace/settings')}
                                className={`nav-icon ${isActive('/workspace/settings') ? 'active' : ''}`}
                                title="Settings"
                            >
                                <FiSettings size={20} /> {/* Settings Icon */}
                            </span>

                            <div className="profile-menu-container">
                                <span
                                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                                    className="nav-icon profile-icon"
                                    title="Profile"
                                >
                                    <FiUser size={20} /> {/* Profile Icon */}
                                </span>
                                {showProfileMenu && (
                                    <div className="profile-dropdown">
                                        {/* Add profile link or other options here later */}
                                        <div className="dropdown-item" onClick={handleLogout}>
                                            <FiLogOut size={16} style={{ marginRight: '8px' }} /> Logout
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    // Login Link
                    <a href="http://localhost:5000/auth/google" className="login-link">Sign In with Google</a>
                )}
            </div>
        </nav>
    );
};

export default Navbar;