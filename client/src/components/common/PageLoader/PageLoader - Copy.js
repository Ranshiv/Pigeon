// client/src/components/common/PageLoader/PageLoader.js
import React from 'react';
import './PageLoader.css';

const PageLoader = ({ size = 'md', label = null, inline = false }) => {
    const sizeClass = `pg-loader--${size}`;
    const wrapClass = `pg-loader${inline ? ' pg-loader--inline' : ''}`;

    return (
        <div className={wrapClass} role="status" aria-live="polite">
            <div className={`pg-spinner ${sizeClass}`} />
            {label && <div className="pg-loader-label">{label}</div>}
        </div>
    );
};

export default PageLoader;
