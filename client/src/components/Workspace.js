import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import APINetworkSection from './APINetworkSection';
import WorkspacesSection from './WorkspacesSection';
import CollectionsManagement from './CollectionsManagement';
import './Workspace.css';
import SettingsPage from './SettingsPage';
import HistoryDetailsSection from './HistoryDetailsSection';

const Workspace = () => {
    return (
        <div className="workspace-container">
            <div className="main-content">
                <Routes>
                    <Route index element={<Navigate to="/workspace/home" />} />
                    <Route path="home" element={<Home />} />
                    <Route path="workspaces/*" element={<WorkspacesSection />} />
                    <Route path="collections/*" element={<CollectionsManagement />} />
                    <Route path="api-network/*" element={<APINetworkSection />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="history/*" element={<HistoryDetailsSection />} />
                </Routes>
            </div>
        </div>
    );
};

export default Workspace;