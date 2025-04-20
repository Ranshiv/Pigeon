import React, { useState, useEffect, useRef } from 'react';
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
    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [navbarVisible, setNavbarVisible] = useState(true);
    const navbarRef = useRef(null);

    // Enhanced scroll effect with smart hide/show based on scroll direction
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.pageYOffset;

            // Set scrolled state for background effects
            setIsScrolled(currentScrollPos > 20);

            // Smart hide/show based on scroll direction
            const visible = prevScrollPos > currentScrollPos || currentScrollPos < 10;

            setNavbarVisible(visible);
            setPrevScrollPos(currentScrollPos);
        };

        window.addEventListener('scroll', handleScroll);

        // Clean up
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [prevScrollPos]);

    // Add item indexes for staggered animations
    useEffect(() => {
        if (navbarRef.current) {
            const navItems = navbarRef.current.querySelectorAll('.navbar-item');
            navItems.forEach((item, index) => {
                item.style.setProperty('--item-index', index + 1);
            });

            const dropdownItems = navbarRef.current.querySelectorAll('.dropdown-item');
            dropdownItems.forEach((item, index) => {
                item.style.setProperty('--item-index', index + 1);
            });
        }
    }, [isMobileMenuOpen, showApiDropdown, showWorkspaceDropdown]);

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

    // Close mobile menu when location changes with a smooth transition
    useEffect(() => {
        if (isMobileMenuOpen) {
            // Add a small delay before closing to allow for a smooth transition effect
            const timer = setTimeout(() => {
                setIsMobileMenuOpen(false);
            }, 300);
            return () => clearTimeout(timer);
        }
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
                // Add a nice transition effect before redirecting
                document.body.classList.add('page-transition');
                setTimeout(() => {
                    window.location.href = '/';
                }, 300);
            } else {
                console.error('Logout failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    // Enhanced click outside handler with smooth transitions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.profile-menu-container') && !event.target.closest('.has-dropdown')) {
                // Smooth hide transitions
                if (showProfileMenu) setShowProfileMenu(false);
                if (showApiDropdown) setShowApiDropdown(false);
                if (showWorkspaceDropdown) setShowWorkspaceDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showProfileMenu, showApiDropdown, showWorkspaceDropdown]);

    // Handle navigation with smooth transitions
    const handleNavigation = (path) => {
        // Add a subtle transition effect
        if (path !== location.pathname) {
            document.body.classList.add('page-transition');
            setTimeout(() => {
                navigate(path);
                document.body.classList.remove('page-transition');
            }, 200);
        }
    };

    return (
        <nav
            className={`navbar ${isScrolled ? 'scrolled' : ''}`}
            style={{ transform: navbarVisible ? 'translateY(0)' : 'translateY(-100%)', transition: 'transform 0.3s ease' }}
            ref={navbarRef}
        >
            <div className="navbar-container">
                <div className="navbar-brand" onClick={() => handleNavigation(isAuthenticated ? '/workspace/home' : '/')}>
                    Pigeon
                </div>

                <div className="hamburger" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </div>

                <div className={`navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
                    {isAuthenticated ? (
                        <>
                            <div className="navbar-start">
                                <div className="navbar-item" onClick={() => handleNavigation('/workspace/home')}>
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
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/workspaces/my-workspace')}>
                                                My Workspace
                                            </div>
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/workspaces/shared')}>
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
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/api-network/explore')}>
                                                <FiGlobe size={16} style={{ marginRight: '10px' }} /> Explore
                                            </div>
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/api-network/spotlight')}>
                                                <FiBell size={16} style={{ marginRight: '10px' }} /> Spotlight
                                            </div>
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/api-network/trending')}>
                                                <FiTrendingUp size={16} style={{ marginRight: '10px' }} /> Trending
                                            </div>
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/api-network/ai-agent-tools')}>
                                                <FiZap size={16} style={{ marginRight: '10px' }} /> AI Agent Tools
                                            </div>
                                            <div className="dropdown-item" onClick={() => handleNavigation('/workspace/api-network/requests/new')}>
                                                <FiPlus size={16} style={{ marginRight: '10px' }} /> Add Request
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="navbar-item" onClick={() => handleNavigation('/workspace/history')}>
                                    <span className={isActive('/workspace/history') ? 'active' : ''}>
                                        <FiClock size={18} /> History
                                    </span>
                                </div>
                            </div>

                            <div className="navbar-end">
                                <div
                                    className="navbar-item"
                                    onClick={() => handleNavigation('/workspace/settings')}
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
                            <a href="http://localhost:5001/auth/google" className="login-button">
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