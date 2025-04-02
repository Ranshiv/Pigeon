import React, { useState, useEffect } from 'react';
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSettings, FiUser, FiLogOut } from 'react-icons/fi';

const Navbar = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showApiDropdown, setShowApiDropdown] = useState(false); // State for API Network dropdown
    const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false); // State for Workspace dropdown
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
    const [userProfileIcon, setUserProfileIcon] = useState(null);

    useEffect(() => {
        const fetchUserIcon = async () => {
            if (isAuthenticated) {
                try {
                    const res = await fetch('/api/auth/check');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.user && data.user.profileIcon) {
                            setUserProfileIcon(data.user.profileIcon);
                        } else {
                            setUserProfileIcon(null);
                        }
                    }
                } catch (err) {
                    console.error("Navbar: Error fetching user data:", err);
                }
            } else {
                setUserProfileIcon(null);
            }
        };

        fetchUserIcon();
    }, [isAuthenticated, location]);

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        if (path === '/workspace/settings') return location.pathname === path;
        if (path.startsWith('/workspace')) return location.pathname.startsWith(path);
        return location.pathname === path;
    };

    const handleLogout = async () => {
        setShowProfileMenu(false);
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
            <div className="hamburger" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                ☰
            </div>
            <div className={`navbar-links ${isMobileMenuOpen ? 'active' : ''}`}>
                {isAuthenticated ? (
                    <>
                        <span onClick={() => navigate('/workspace/home')} className={`nav-item ${isActive('/workspace/home') ? 'active' : ''}`} title="Home"> Home </span>

                        {/* Workspace with Dropdown */}
                        <div
                            className="nav-item workspace-dropdown"
                            onMouseEnter={() => setShowWorkspaceDropdown(true)}
                            onMouseLeave={() => setShowWorkspaceDropdown(false)}
                        >
                            <span className={`nav-item ${isActive('/workspace/workspaces') ? 'active' : ''}`} title="Workspace">
                                Workspace
                            </span>
                            {showWorkspaceDropdown && (
                                <div className="dropdown-menu">
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/workspaces/my-workspace')}>
                                        My Workspace
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/workspaces/shared')}>
                                        Shared
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* API Network with Dropdown */}
                        <div
                            className="nav-item api-network-dropdown"
                            onMouseEnter={() => setShowApiDropdown(true)}
                            onMouseLeave={() => setShowApiDropdown(false)}
                        >
                            <span className={`nav-item ${isActive('/workspace/api-network') ? 'active' : ''}`} title="API Network">
                                API Network
                            </span>
                            {showApiDropdown && (
                                <div className="dropdown-menu">
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/explore')}>
                                        Explore
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/spotlight')}>
                                        Spotlight
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/trending')}>
                                        Trending
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/ai-agent-tools')}>
                                        AI Agent Tools
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/requests/new')}>
                                        Add Request
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="navbar-icons">
                            <span onClick={() => navigate('/workspace/settings')} className={`nav-icon ${isActive('/workspace/settings') ? 'active' : ''}`} title="Settings">
                                <FiSettings size={20} />
                            </span>

                            <div className="profile-menu-container">
                                <span onClick={() => setShowProfileMenu(!showProfileMenu)} className="nav-icon profile-icon" title="Profile">
                                    {userProfileIcon ? (
                                        <img src={`/assets/icons/${userProfileIcon}`} alt="Profile" className="navbar-profile-img" />
                                    ) : (
                                        <FiUser size={20} />
                                    )}
                                </span>
                                {showProfileMenu && (
                                    <div className="profile-dropdown">
                                        <div className="dropdown-item" onClick={handleLogout}>
                                            <FiLogOut size={16} style={{ marginRight: '8px' }} /> Logout
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <a href="http://localhost:5000/auth/google" className="login-link">Sign In with Google</a>
                )}
            </div>
        </nav>
    );
};

export default Navbar;