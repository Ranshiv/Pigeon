// client/src/components/Navbar.js (Modified)
import React, { useState, useEffect } from 'react'; // Import useEffect
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSettings, FiUser, FiLogOut } from 'react-icons/fi';

const Navbar = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [userProfileIcon, setUserProfileIcon] = useState(null); // State for user's icon

    // Fetch user data specifically for the Navbar (or pass currentUser down from App)
    // This approach fetches independently, which is simpler for now.
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
                            setUserProfileIcon(null); // Reset if no icon
                        }
                    }
                } catch (err) {
                    console.error("Navbar: Error fetching user data:", err);
                }
            } else {
                setUserProfileIcon(null); // Clear icon if not authenticated
            }
        };

        fetchUserIcon();
    }, [isAuthenticated, location]); // Re-fetch if auth state or location changes


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
            <div className="navbar-links">
                {isAuthenticated ? (
                    <>
                        {/* Main navigation links */}
                        <span onClick={() => navigate('/workspace/home')} className={`nav-item ${isActive('/workspace/home') ? 'active' : ''}`} title="Home"> Home </span>
                        <span onClick={() => navigate('/workspace/workspaces')} className={`nav-item ${isActive('/workspace/workspaces') ? 'active' : ''}`} title="Workspaces"> Workspaces </span>
                        <span onClick={() => navigate('/workspace/api-network')} className={`nav-item ${isActive('/workspace/api-network') ? 'active' : ''}`} title="API Network"> API Network </span>

                        {/* Icons on the right */}
                        <div className="navbar-icons">
                            <span onClick={() => navigate('/workspace/settings')} className={`nav-icon ${isActive('/workspace/settings') ? 'active' : ''}`} title="Settings">
                                <FiSettings size={20} />
                            </span>

                            <div className="profile-menu-container">
                                <span onClick={() => setShowProfileMenu(!showProfileMenu)} className="nav-icon profile-icon" title="Profile">
                                    {/* Conditionally render selected icon or default */}
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