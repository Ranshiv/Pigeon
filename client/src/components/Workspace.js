import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import APINetworkSection from './APINetworkSection';
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
                    <Route path="workspaces/my-workspace" element={<div>My Workspace</div>} />
                    <Route path="workspaces/shared" element={<div>Shared Workspace</div>} />
                    <Route path="api-network/*" element={<APINetworkSection />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="history/*" element={<HistoryDetailsSection />} />
                </Routes>
            </div>
        </div>
    );
};

export default Workspace;