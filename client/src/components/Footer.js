// client/src/components/Footer.js
import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <p>© {new Date().getFullYear()} Pigeon. All rights reserved.</p>
        </footer>
    );
};

export default Footer;