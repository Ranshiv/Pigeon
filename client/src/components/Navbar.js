// client/src/components/Navbar.js
import React from 'react';
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const handleLogout = async () => {
        try {
            const response = await fetch('/api/auth/logout'); // Use relative path for API call
            if (response.ok) {
                window.location.href = '/'; // Force a full page reload to clear state
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
                        <span
                            onClick={() => navigate('/workspace/home')}
                            className={isActive('/workspace/home') ? 'active' : ''}
                        >
                            Home
                        </span>
                        <span
                            onClick={() => navigate('/workspace/workspaces')}
                            className={isActive('/workspace/workspaces') ? 'active' : ''}
                        >
                            Workspaces
                        </span>
                        <span
                            onClick={() => navigate('/workspace/api-network')}
                            className={isActive('/workspace/api-network') ? 'active' : ''}
                        >
                            API Network
                        </span>
                        <span onClick={handleLogout} style={{ cursor: 'pointer' }}>
                            Logout
                        </span>
                    </>
                ) : (
                    // Use the ABSOLUTE backend URL for Google Sign-In
                    <a href="http://localhost:5000/auth/google">Sign In with Google</a>
                )}
            </div>
        </nav>
    );
};

export default Navbar;