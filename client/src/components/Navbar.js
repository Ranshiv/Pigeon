import React from 'react';
import './Navbar.css';
import { useNavigate } from 'react-router-dom'; // Import useNavigate


const Navbar = () => {
    const navigate = useNavigate(); // Use useNavigate

    return (
        <nav className="navbar">
            <div
                className="navbar-brand"
                onClick={() => navigate('/')} // Navigate to home on click
                style={{ cursor: 'pointer' }}
            >
                Pigeon
            </div>
        </nav>
    );
};

export default Navbar;