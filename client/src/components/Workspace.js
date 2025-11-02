import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import APINetworkSection from './APINetworkSection';
import WorkspacesSection from './WorkspacesSection';
import CollectionsManagement from './CollectionsManagement';
import CollectionDetail from './CollectionDetail';
import CollectionCreate from './CollectionCreate';
import DocumentationManager from './DocumentationManager';
import MonitoringDashboard from './MonitoringDashboard';
import MonitoringHistory from './MonitoringHistory';
import ReportsManagement from './ReportsManagement';
import TeamsManagement from './TeamsManagement';
import IntegrationsManagement from './IntegrationsManagement';
import MaintenanceManagement from './MaintenanceManagement';
import AnalyticsDashboard from './Analytics/AnalyticsDashboard';
import './Workspace.css';
import SettingsPage from './SettingsPage';
import HistoryDetailsSection from './HistoryDetailsSection';

const Workspace = () => {
    return (
        <Routes>
            <Route index element={<Navigate to="/workspace/home" />} />
            <Route path="home" element={<Home />} />
            <Route path="workspaces/*" element={<WorkspacesSection />} />

            {/* The order of these routes matters - more specific routes should come first */}
            <Route path="collections/new" element={<CollectionCreate />} />
            <Route path="collections/:collectionId/documentation" element={<DocumentationManager />} />
            <Route path="collections/:collectionId" element={<CollectionDetail />} />            <Route path="collections" element={<CollectionsManagement />} />            <Route path="api-network/*" element={<APINetworkSection />} />            <Route path="monitoring/:id/analytics" element={<AnalyticsDashboard />} />
            <Route path="monitoring/:id/history" element={<MonitoringHistory />} />
            <Route path="monitoring/reports" element={<ReportsManagement />} />
            <Route path="monitoring/teams" element={<TeamsManagement />} />
            <Route path="monitoring/integrations" element={<IntegrationsManagement />} />
            <Route path="monitoring/maintenance" element={<MaintenanceManagement />} />
            <Route path="monitoring" element={<MonitoringDashboard />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="history/*" element={<HistoryDetailsSection />} />

            {/* Add a catch-all redirect for unmatched routes under collections */}
            <Route path="collections/*" element={<Navigate to="/workspace/collections" />} />
        </Routes>
    );
};

export default Workspace;