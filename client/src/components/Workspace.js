// client/src/components/Workspace.js (Simplified)
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Home from './Home';
// REMOVED: WorkspacesSection import
import APINetworkSection from './APINetworkSection';
import './Workspace.css';
import SettingsPage from './SettingsPage';
const Workspace = () => {
    // Moved request and response state to APINetworkSection
    const navigate = useNavigate();

    return (
        <div className="workspace-container">
            {/* <div className="sidebar">
                <div className="sidebar-section" onClick={() => navigate('home')}>
                    Home
                </div>
                <div className="sidebar-section" onClick={() => navigate('workspaces')}>
                    Workspaces
                </div>
                <div className="sidebar-section" onClick={() => navigate('api-network')}>
                    API Network
                </div>
            </div> */}
            {/* <div className="sidebar-section" onClick={() => navigate('settings')}>
                Settings
            </div> */}
            <div className="main-content">
                <Routes>
                    <Route index element={<Navigate to="/workspace/home" />} />
                    <Route path="home" element={<Home />} />
                    <Route path="workspaces" element={<div>Workspaces (Empty for now)</div>} />
                    <Route path="api-network/*" element={<APINetworkSection />} />
                    <Route path="settings" element={<SettingsPage />} /> {/* Add Settings Route */}
                </Routes>
            </div>
        </div>
    );
};

export default Workspace;