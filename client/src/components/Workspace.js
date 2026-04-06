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
import GraphQLTestPage from './GraphQLTestPage';
import ProtocolTestPage from './ProtocolTestPage';
import PerformanceTestsPage from './performanceTesting/PerformanceTestsPage';
import ComplianceSection from './compliance/ComplianceSection';
import './Workspace.css';
import SettingsPage from './SettingsPage';
import HistoryDetailsSection from './HistoryDetailsSection';

import { useCollaboration } from '../context/CollaborationContext';
import CursorOverlay from './collaboration/CursorOverlay';

import VideoChatOverlay from './collaboration/VideoChatOverlay';
import ActivityFeed from './collaboration/ActivityFeed';
import ReviewDashboard from './collaboration/ReviewDashboard';

const Workspace = () => {
    const { emitCursorMove } = useCollaboration();

    const handleMouseMove = (e) => {
        // Debounce happens in context or socket layer usually, but simple throttling here is okay too
        // or rely on the context's volatile emit
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        // Only emit if within bounds (0-1)
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
            emitCursorMove({ x, y }, window.location.pathname);
        }
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh' }} onMouseMove={handleMouseMove}>
            <CursorOverlay />
            <VideoChatOverlay />
            <ActivityFeed />

            <Routes>
                <Route index element={<Navigate to="/workspace/home" />} />
                <Route path="home" element={<Home />} />
                <Route path="workspaces/*" element={<WorkspacesSection />} />

                {/* Process Reviews & Collaboration */}
                <Route path="reviews" element={<ReviewDashboard />} />

                {/* The order of these routes matters - more specific routes should come first */}
                <Route path="collections/new" element={<CollectionCreate />} />
                <Route path="collections/:collectionId/documentation" element={<DocumentationManager />} />
                <Route path="collections/:collectionId" element={<CollectionDetail />} />            <Route path="collections" element={<CollectionsManagement />} />            <Route path="api-network/*" element={<APINetworkSection />} />
                <Route path="monitoring/:id/analytics" element={<AnalyticsDashboard />} />
                <Route path="monitoring/:id/history" element={<MonitoringHistory />} />
                <Route path="monitoring/reports" element={<ReportsManagement />} />
                <Route path="monitoring/teams" element={<TeamsManagement />} />
                <Route path="monitoring/integrations" element={<IntegrationsManagement />} />
                <Route path="monitoring/maintenance" element={<MaintenanceManagement />} />
                <Route path="monitoring" element={<MonitoringDashboard />} />
                <Route path="graphql" element={<GraphQLTestPage />} />
                <Route path="protocols" element={<ProtocolTestPage />} />
                <Route path="performance-tests" element={<PerformanceTestsPage />} />
                <Route path="compliance/*" element={<ComplianceSection />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="history/*" element={<HistoryDetailsSection />} />

                {/* Add a catch-all redirect for unmatched routes under collections */}
                <Route path="collections/*" element={<Navigate to="/workspace/collections" />} />
            </Routes>
        </div>
    );
};

export default Workspace;