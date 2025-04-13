import React, { useState, useEffect } from 'react';
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FiSettings,
    FiUser,
    FiLogOut,
    FiMenu,
    FiX,
    FiHome,
    FiGrid,
    FiGlobe,
    FiBell,
    FiClock,
    FiTrendingUp,
    FiZap,
    FiPlus
} from 'react-icons/fi';

const Navbar = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showApiDropdown, setShowApiDropdown] = useState(false);
    const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userProfileIcon, setUserProfileIcon] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);

    // Add scroll event listener to detect when to change navbar background
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);

        // Clean up
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

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

    // Close mobile menu when location changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        if (path === '/workspace/settings') return location.pathname === path;
        if (path.startsWith('/workspace')) return location.pathname.startsWith(path);
        return location.pathname === path;
    };

    const handleLogout = async () => {
        setShowProfileMenu(false);
        setIsMobileMenuOpen(false);
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

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.profile-menu-container') && !event.target.closest('.has-dropdown')) {
                setShowProfileMenu(false);
                setShowApiDropdown(false);
                setShowWorkspaceDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="navbar-container">
                <div className="navbar-brand" onClick={() => navigate(isAuthenticated ? '/workspace/home' : '/')}>
                    Pigeon
                </div>

                <div className="hamburger" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </div>

                <div className={`navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
                    {isAuthenticated ? (
                        <>
                            <div className="navbar-start">
                                <div className="navbar-item" onClick={() => navigate('/workspace/home')}>
                                    <span className={isActive('/workspace/home') ? 'active' : ''}>
                                        <FiHome size={18} /> Home
                                    </span>
                                </div>

                                {/* Workspace dropdown */}
                                <div
                                    className="navbar-item has-dropdown"
                                    onMouseEnter={() => setShowWorkspaceDropdown(true)}
                                    onMouseLeave={() => setShowWorkspaceDropdown(false)}
                                >
                                    <span className={isActive('/workspace/workspaces') ? 'active' : ''}>
                                        <FiGrid size={18} /> Workspace
                                    </span>

                                    {showWorkspaceDropdown && (
                                        <div className="navbar-dropdown">
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/workspaces/my-workspace')}>
                                                My Workspace
                                            </div>
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/workspaces/shared')}>
                                                Shared
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* API Network dropdown */}
                                <div
                                    className="navbar-item has-dropdown"
                                    onMouseEnter={() => setShowApiDropdown(true)}
                                    onMouseLeave={() => setShowApiDropdown(false)}
                                >
                                    <span className={isActive('/workspace/api-network') ? 'active' : ''}>
                                        <FiGlobe size={18} /> API Network
                                    </span>

                                    {showApiDropdown && (
                                        <div className="navbar-dropdown">
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/explore')}>
                                                <FiGlobe size={16} style={{ marginRight: '10px' }} /> Explore
                                            </div>
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/spotlight')}>
                                                <FiBell size={16} style={{ marginRight: '10px' }} /> Spotlight
                                            </div>
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/trending')}>
                                                <FiTrendingUp size={16} style={{ marginRight: '10px' }} /> Trending
                                            </div>
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/ai-agent-tools')}>
                                                <FiZap size={16} style={{ marginRight: '10px' }} /> AI Agent Tools
                                            </div>
                                            <div className="dropdown-item" onClick={() => navigate('/workspace/api-network/requests/new')}>
                                                <FiPlus size={16} style={{ marginRight: '10px' }} /> Add Request
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="navbar-item" onClick={() => navigate('/workspace/history')}>
                                    <span className={isActive('/workspace/history') ? 'active' : ''}>
                                        <FiClock size={18} /> History
                                    </span>
                                </div>
                            </div>

                            <div className="navbar-end">
                                <div
                                    className="navbar-item"
                                    onClick={() => navigate('/workspace/settings')}
                                >
                                    <span className={isActive('/workspace/settings') ? 'active' : ''}>
                                        <FiSettings size={18} />
                                    </span>
                                </div>

                                <div className="navbar-item profile-menu-container">
                                    <div
                                        className="profile-trigger"
                                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                                    >
                                        {userProfileIcon ? (
                                            <img
                                                src={`/assets/icons/${userProfileIcon}`}
                                                alt="Profile"
                                                className="navbar-profile-img"
                                            />
                                        ) : (
                                            <FiUser size={20} />
                                        )}
                                    </div>

                                    {showProfileMenu && (
                                        <div className="profile-dropdown">
                                            <div className="dropdown-item" onClick={handleLogout}>
                                                <FiLogOut size={16} style={{ marginRight: '10px' }} /> Logout
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="navbar-end">
                            <a href="http://localhost:5000/auth/google" className="login-button">
                                Sign In
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;