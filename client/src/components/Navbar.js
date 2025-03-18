// client/src/components/Navbar.js
import React from 'react';
import './Navbar.css';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Helper function to determine if a link is active
    const isActive = (path) => {
        return location.pathname.startsWith(path); // Use startsWith for nested routes
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                Pigeon
            </div>
            <div className="navbar-links">
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
            </div>
        </nav>
    );
};

export default Navbar;