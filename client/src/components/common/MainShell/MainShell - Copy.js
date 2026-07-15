// client/src/components/common/MainShell/MainShell.js
import React from 'react';
import './MainShell.css';

const MainShell = ({
    title,
    crumb,
    icon,
    actions,
    subbar,
    flush = false,
    children,
    className = '',
}) => (
    <div className={`mn-shell ${className}`}>
        {(title || crumb || icon || actions) && (
            <header className="mn-shell__header">
                {icon && <span className="mn-shell__icon">{icon}</span>}
                <div className="mn-shell__heading">
                    {crumb && <div className="mn-shell__crumb">{crumb}</div>}
                    {title && <div className="mn-shell__title">{title}</div>}
                </div>
                {actions && <div className="mn-shell__actions">{actions}</div>}
            </header>
        )}
        {subbar && <div className="mn-shell__subbar">{subbar}</div>}
        <div className={`mn-shell__body ${flush ? 'mn-shell__body--flush' : ''}`}>
            {children}
        </div>
    </div>
);

export default MainShell;
