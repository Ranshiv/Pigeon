// client/src/components/compliance/ComplianceSection.js
import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { FiShield, FiBookOpen, FiLock } from 'react-icons/fi';
import AuditLogPage from './AuditLogPage';
import PoliciesPage from './PoliciesPage';
import AccessReviewPage from './AccessReviewPage';
import './compliance.css';

const TABS = [
    { to: 'audit-log', label: 'Audit Log', icon: FiShield },
    { to: 'policies', label: 'Policies', icon: FiBookOpen },
    { to: 'access-review', label: 'Access Review', icon: FiLock }
];

const ComplianceSection = () => {
    return (
        <div className="cmp-root">
            <header className="cmp-header">
                <div className="cmp-header-text">
                    <span className="cmp-eyebrow">Governance</span>
                    <h1 className="cmp-title">Compliance</h1>
                    <p className="cmp-subtitle">Audit logging, retention policies, and governance exports.</p>
                </div>
            </header>

            <nav className="cmp-tabs" aria-label="Compliance sections">
                {TABS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => `cmp-tab${isActive ? ' cmp-tab--active' : ''}`}
                    >
                        <Icon className="cmp-tab-icon" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="cmp-content">
                <Routes>
                    <Route index element={<Navigate to="audit-log" replace />} />
                    <Route path="audit-log" element={<AuditLogPage />} />
                    <Route path="policies" element={<PoliciesPage />} />
                    <Route path="access-review" element={<AccessReviewPage />} />
                    <Route path="*" element={<Navigate to="audit-log" replace />} />
                </Routes>
            </div>
        </div>
    );
};

export default ComplianceSection;
