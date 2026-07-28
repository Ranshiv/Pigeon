import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Workspace from './components/Workspace';
import PublicHome from './components/PublicHome';
import DocumentationOverview, { DocumentationArticle } from './components/DocumentationOverview';
import OAuthCallback from './components/OAuthCallback';
import PublicDocumentationPage from './components/PublicDocumentationPage';
import LegalPage from './components/LegalPage';
import PageLoader from './components/common/PageLoader/PageLoader';
import CommandPalette from './components/CommandPalette';
import './App.css';
import './theme-overrides.css';

const APP_NAME = 'Pigeon';

const formatSegment = (segment = '') =>
  segment
    .replaceAll(/[-_]/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const getPageTitle = (pathname) => {
  if (!pathname || pathname === '/') return 'Home';

  if (/^\/workspace\/collections\/new\/?$/.test(pathname)) return 'New Collection';
  if (/^\/workspace\/collections\/[^/]+\/documentation\/?$/.test(pathname)) return 'Collection Documentation';
  if (/^\/workspace\/collections\/[^/]+\/?$/.test(pathname)) return 'Collection Details';
  if (/^\/workspace\/monitoring\/[^/]+\/analytics\/?$/.test(pathname)) return 'Monitoring Analytics';
  if (/^\/workspace\/monitoring\/[^/]+\/history\/?$/.test(pathname)) return 'Monitoring History';
  if (/^\/workspace\/settings\/(profile|appearance|notifications|account)\/?$/.test(pathname)) {
    const section = pathname.split('/')[3] || 'profile';
    return `${formatSegment(section)} Settings`;
  }
  const staticRouteTitles = {
    '/workspace': 'Workspace',
    '/workspace/home': 'Home',
    '/workspace/workspaces': 'Workspaces',
    '/workspace/collections': 'Collections',
    '/workspace/api-network': 'API Network',
    '/workspace/api-network/mcp': 'MCP Workbench',
    '/workspace/monitoring': 'Monitoring',
    '/workspace/monitoring/reports': 'Monitoring Reports',
    '/workspace/monitoring/teams': 'Teams',
    '/workspace/monitoring/integrations': 'Integrations',
    '/workspace/monitoring/maintenance': 'Maintenance',
    '/workspace/graphql': 'GraphQL Tester',
    '/workspace/protocols': 'Protocol Tester',
    '/workspace/performance-tests': 'Performance Tests',
    '/workspace/compliance': 'Compliance',
    '/workspace/governance': 'Governance',
    '/workspace/consumer-contracts': 'Consumer Contracts',
    '/workspace/trace-to-test': 'Trace to Test',
    '/workspace/asyncapi': 'AsyncAPI',
    '/workspace/settings': 'Settings',
    '/workspace/history': 'History',
    '/workspace/monitoring/alerts': 'Alerts Dashboard',
    '/workspace/monitoring/policies': 'Alert Policies',
    '/documentation': 'Documentation',
    '/privacy': 'Privacy Policy',
    '/terms': 'Terms of Service',
    '/oauth/callback': 'OAuth Callback'
  };

  if (staticRouteTitles[pathname]) {
    return staticRouteTitles[pathname];
  }

  if (pathname.startsWith('/workspace/')) {
    const [, , section] = pathname.split('/');
    return formatSegment(section) || 'Workspace';
  }

  const [, topLevel] = pathname.split('/');
  return formatSegment(topLevel) || 'Page';
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const isPublicLanding = location.pathname === '/' && !isAuthenticated;

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ${APP_NAME}`;
  }, [location.pathname]);

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = async () => {
      try {
        // Updated to use the full URL like other API calls in the application
        const res = await fetch('/api/auth/check', {
          credentials: 'include'
        });

        if (!res.ok) {
          throw new Error('Authentication check failed');
        }

        const data = await res.json();
        setIsAuthenticated(data.isAuthenticated);

        // Store user data in localStorage if authenticated
        if (data.isAuthenticated && data.user) {
          localStorage.setItem('user', JSON.stringify({
            id: data.user._id || data.user.id,
            displayName: data.user.displayName || data.user.name || "User",
            email: data.user.email,
            profileIcon: data.user.profileIcon,
            notificationPreferences: data.user.notificationPreferences
          }));
        }
      } catch (err) {
        console.error("Error checking auth:", err);
        setIsAuthenticated(false); // Assume not authenticated on error
      } finally {
        setIsLoading(false); // Always stop loading after auth check
      }
    };

    checkAuth();
  }, []);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="App" style={{ display: 'flex', height: '100vh' }}>
        <PageLoader size="lg" label="Loading..." />
      </div>
    );
  }

  return (
    <div className={`App${isPublicLanding ? ' App--marketing' : ''}`}>
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/workspace" /> : <PublicHome />} />
          <Route path="/workspace/*" element={isAuthenticated ? <Workspace /> : <Navigate to="/" />} />
          <Route path="/alerts" element={isAuthenticated ? <Navigate to="/workspace/monitoring/alerts" /> : <Navigate to="/" />} />
          <Route path="/alerts/policies" element={isAuthenticated ? <Navigate to="/workspace/monitoring/policies" /> : <Navigate to="/" />} />
          <Route path="/documentation" element={<DocumentationOverview />} /> {/* Add the documentation route */}
          <Route path="/documentation/:category/:guide" element={<DocumentationArticle />} />
          <Route path="/docs/:collectionId" element={<PublicDocumentationPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} /> {/* OAuth callback route */}
          <Route path="*" element={<div className="not-found-container" style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
            <h2>404 - Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <p>If you're trying to access a mock API endpoint, please use an API client like Postman or make the request programmatically.</p>
            <a href="/" style={{ color: '#4a9eff', textDecoration: 'underline' }}>Go to Home</a>
          </div>} />
        </Routes>
      </main>
      <CommandPalette isAuthenticated={isAuthenticated} />
      {/* api-network is a fixed-height app-shell that renders its own footer inside
          the scroll region — a second global footer here would create a 2nd scrollbar */}
      {!isPublicLanding && !location.pathname.startsWith('/workspace/api-network') && <Footer />}
    </div>
  );
}

export default App;
