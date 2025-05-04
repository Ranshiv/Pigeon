import React, { useState, useEffect, useRef } from 'react';
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FiSettings,
    FiUser,
    FiUsers,
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
    FiPlus,
    FiSearch,
    FiCheck,
    FiChevronRight
} from 'react-icons/fi';
import Notifications from './Notifications'; // Import the Notifications component
import { useCollaboration } from '../context/CollaborationContext';

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
    const workspaceDropdownRef = useRef(null);
    const { socket } = useCollaboration();

    // Workspace state
    const [myWorkspaces, setMyWorkspaces] = useState([]);
    const [recentWorkspaces, setRecentWorkspaces] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
    const searchInputRef = useRef(null);

    // Fetch workspaces when dropdown opens and when navigating back to workspaces page
    useEffect(() => {
        if ((showWorkspaceDropdown && isAuthenticated) ||
            (isAuthenticated && location.pathname.includes('/workspace/workspaces'))) {
            fetchWorkspaces();
        }
    }, [showWorkspaceDropdown, isAuthenticated, location.pathname]);

    // Function to fetch workspaces
    const fetchWorkspaces = async () => {
        try {
            setIsLoadingWorkspaces(true);
            const response = await fetch('http://localhost:5001/api/workspaces', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // Process workspaces data
                let allWorkspaces = [];
                if (data.personal) allWorkspaces = [...allWorkspaces, ...data.personal];
                if (data.team) allWorkspaces = [...allWorkspaces, ...data.team];

                setMyWorkspaces(allWorkspaces);

                // Set recent workspaces (first 2 for recently visited)
                setRecentWorkspaces(allWorkspaces.slice(0, 2));
            }
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    };

    // Filter workspaces based on search query
    const filteredWorkspaces = searchQuery ?
        myWorkspaces.filter(workspace =>
            workspace.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) :
        myWorkspaces;

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
    }, [location.pathname, isMobileMenuOpen]);

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
            // Don't close workspace dropdown if clicking inside it
            if (showWorkspaceDropdown &&
                workspaceDropdownRef.current &&
                workspaceDropdownRef.current.contains(event.target)) {
                return;
            }

            // For other dropdowns
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
                                    onClick={() => {
                                        setShowWorkspaceDropdown(!showWorkspaceDropdown);
                                        // Close API dropdown when Workspace dropdown opens
                                        if (showApiDropdown) setShowApiDropdown(false);
                                        // Focus the search input when dropdown opens
                                        if (!showWorkspaceDropdown) {
                                            setTimeout(() => {
                                                if (searchInputRef.current) {
                                                    searchInputRef.current.focus();
                                                }
                                            }, 100);
                                        }
                                    }}
                                >
                                    <span className={isActive('/workspace/workspaces') ? 'active' : ''}>
                                        <FiGrid size={18} /> Workspaces
                                    </span>

                                    {showWorkspaceDropdown && (
                                        <div className="workspace-selector-dropdown" ref={workspaceDropdownRef}>
                                            <div className="workspace-search-container">
                                                <FiSearch className="search-icon" />
                                                <input
                                                    ref={searchInputRef}
                                                    type="text"
                                                    className="workspace-search-input"
                                                    placeholder="Search workspaces"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                className="create-workspace-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Navigate to workspaces page and set a flag to show create modal
                                                    handleNavigation('/workspace/workspaces?create=true');
                                                    setShowWorkspaceDropdown(false);
                                                }}
                                            >
                                                Create Workspace
                                            </button>

                                            {/* Recently visited section */}
                                            <div className="workspace-section">
                                                <h3 className="workspace-section-title">Recently visited</h3>
                                                <div className="workspace-list">
                                                    {recentWorkspaces.length > 0 ? recentWorkspaces.map(workspace => (
                                                        <div
                                                            key={workspace._id}
                                                            className="workspace-item"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNavigation(`/workspace/workspaces/${workspace._id}`);
                                                                setShowWorkspaceDropdown(false);
                                                            }}
                                                        >
                                                            <div className="workspace-icon-small">
                                                                {workspace.isPersonal ? (
                                                                    <FiUser />
                                                                ) : (
                                                                    <FiUsers />
                                                                )}
                                                            </div>
                                                            <div className="workspace-name">
                                                                {workspace.name}
                                                                {workspace._id === location.pathname.split('/').pop() && (
                                                                    <FiCheck className="current-workspace-indicator" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="workspace-item">
                                                            <div className="workspace-icon-small">
                                                                <FiUser />
                                                            </div>
                                                            <div className="workspace-name">
                                                                My Workspace
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* More workspaces section */}
                                            <div className="workspace-section">
                                                <h3 className="workspace-section-title">More workspaces</h3>
                                                <div className="workspace-list">
                                                    <div
                                                        className="workspace-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNavigation(`/workspace/workspaces/team`);
                                                            setShowWorkspaceDropdown(false);
                                                        }}
                                                    >
                                                        <div className="workspace-icon-small">
                                                            <FiUsers />
                                                        </div>
                                                        <div className="workspace-name">
                                                            Team Workspace
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* View all workspaces link */}
                                            <div
                                                className="view-all-workspaces"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleNavigation('/workspace/workspaces');
                                                    setShowWorkspaceDropdown(false);
                                                }}
                                            >
                                                View all workspaces <FiChevronRight />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* API Network dropdown */}
                                <div
                                    className="navbar-item has-dropdown"
                                    onClick={() => {
                                        setShowApiDropdown(!showApiDropdown);
                                        // Close workspace dropdown when API dropdown opens
                                        if (showWorkspaceDropdown) setShowWorkspaceDropdown(false);
                                    }}
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
                                {/* Add Notifications component here */}
                                <div className="navbar-item notifications-menu">
                                    <Notifications />
                                </div>

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