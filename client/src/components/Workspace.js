import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import APINetworkSection from './APINetworkSection';
import WorkspacesSection from './WorkspacesSection';
import CollectionDetail from './CollectionDetail';
import DocumentationManager from './DocumentationManager';
import MonitoringDashboard from './MonitoringDashboard';
import MonitoringHistory from './MonitoringHistory';
import ReportsManagement from './ReportsManagement';
import TeamsManagement from './TeamsManagement';
import IntegrationsManagement from './IntegrationsManagement';
import MaintenanceManagement from './MaintenanceManagement';
import IncidentManagement from './IncidentManagement';
import AnalyticsDashboard from './Analytics/AnalyticsDashboard';
import AlertsDashboard from './alerting/AlertsDashboard';
import AlertPolicyEditor from './alerting/AlertPolicyEditor';
import GraphQLTestPage from './GraphQLTestPage';
import ProtocolTestPage from './ProtocolTestPage';
import PerformanceTestsPage from './performanceTesting/PerformanceTestsPage';
import ComplianceSection from './compliance/ComplianceSection';
import GovernanceSection from './governance/GovernanceSection';
import ConsumerContractsSection from './consumerContracts/ConsumerContractsSection';
import TraceToTestSection from './traceToTest/TraceToTestSection';
import AsyncApiSection from './asyncapi/AsyncApiSection';
import './Workspace.css';
import SettingsPage from './SettingsPage';
import HistoryDetailsSection from './HistoryDetailsSection';

import { useCollaboration } from '../context/CollaborationContext';

import VideoChatOverlay from './collaboration/VideoChatOverlay';
import ActivityFeed from './collaboration/ActivityFeed';

const Workspace = () => {
    const { joinWorkspace, connected } = useCollaboration();
    const [isActivityOpen, setIsActivityOpen] = useState(false);

    useEffect(() => {
        if (connected) {
            joinWorkspace('default');
        }
    }, [connected, joinWorkspace]);

    return (
        <div style={{ position: 'relative' }}>
            <VideoChatOverlay />
            <ActivityFeed isOpen={isActivityOpen} onToggle={() => setIsActivityOpen(o => !o)} />

            <Routes>
                <Route index element={<Navigate to="/workspace/home" />} />
                <Route path="home" element={<Home />} />
                <Route path="workspaces/*" element={<WorkspacesSection />} />

                {/* The order of these routes matters - more specific routes should come first */}
                <Route path="collections/new" element={<Navigate to="/workspace/workspaces" replace />} />
                <Route path="collections/:collectionId/documentation/*" element={<DocumentationManager />} />
                <Route path="collections/:collectionId" element={<CollectionDetail />} />
                <Route path="collections" element={<Navigate to="/workspace/workspaces" replace />} />
                <Route path="api-network/*" element={<APINetworkSection />} />
                <Route path="monitoring/:id/analytics" element={<AnalyticsDashboard />} />
                <Route path="monitoring/:id/history" element={<MonitoringHistory />} />
                <Route path="monitoring/reports" element={<ReportsManagement />} />
                <Route path="monitoring/teams" element={<TeamsManagement />} />
                <Route path="monitoring/integrations" element={<IntegrationsManagement />} />
                <Route path="monitoring/maintenance" element={<MaintenanceManagement />} />
                <Route path="monitoring/incidents" element={<IncidentManagement />} />
                <Route path="monitoring/new" element={<MonitoringDashboard createOnLoad />} />
                <Route path="monitoring/alerts" element={<AlertsDashboard />} />
                <Route path="monitoring/policies" element={<AlertPolicyEditor />} />
                <Route path="monitoring" element={<MonitoringDashboard />} />
                <Route path="graphql" element={<GraphQLTestPage />} />
                <Route path="protocols" element={<ProtocolTestPage />} />
                <Route path="performance-tests" element={<PerformanceTestsPage />} />
                <Route path="compliance/*" element={<ComplianceSection />} />
                <Route path="governance" element={<GovernanceSection />} />
                <Route path="consumer-contracts" element={<ConsumerContractsSection />} />
                <Route path="trace-to-test" element={<TraceToTestSection />} />
                <Route path="asyncapi" element={<AsyncApiSection />} />
                <Route path="settings" element={<Navigate to="/workspace/settings/profile" replace />} />
                <Route path="settings/:section/*" element={<SettingsPage />} />
                <Route path="history/*" element={<HistoryDetailsSection />} />

                {/* Legacy collection-list URLs now resolve through their owning workspace. */}
                <Route path="collections/*" element={<Navigate to="/workspace/workspaces" replace />} />
            </Routes>
        </div>
    );
};

export default Workspace;
