// client/src/components/compliance/ComplianceSection.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuditLogPage from './AuditLogPage';
import PoliciesPage from './PoliciesPage';
import AccessReviewPage from './AccessReviewPage';
import './compliance.css';

const ComplianceSection = () => {
    return (
        <div className="compliance-page">
            <div className="compliance-header">
                <div>
                    <h1 className="compliance-title">Compliance</h1>
                    <p className="compliance-subtitle">Audit logging, retention policies, and governance exports.</p>
                </div>
            </div>

            <div className="compliance-content">
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
