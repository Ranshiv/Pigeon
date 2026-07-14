import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Workspace from './components/Workspace';
import PublicHome from './components/PublicHome';
import DocumentationOverview from './components/DocumentationOverview';
import PublicStatusPage from './components/PublicStatusPage';
import EnhancedPublicStatusPage from './components/EnhancedPublicStatusPage';
import OAuthCallback from './components/OAuthCallback';
import AlertsDashboard from './components/alerting/AlertsDashboard';
import AlertPolicyEditor from './components/alerting/AlertPolicyEditor';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

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
  if (/^\/status\/[^/]+\/?$/.test(pathname)) return 'Public Status Page';

  const staticRouteTitles = {
    '/workspace': 'Workspace',
    '/workspace/home': 'Home',
    '/workspace/workspaces': 'Workspaces',
    '/workspace/reviews': 'Reviews',
    '/workspace/collections': 'Collections',
    '/workspace/api-network': 'API Network',
    '/workspace/monitoring': 'Monitoring',
    '/workspace/monitoring/reports': 'Monitoring Reports',
    '/workspace/monitoring/teams': 'Teams',
    '/workspace/monitoring/integrations': 'Integrations',
    '/workspace/monitoring/maintenance': 'Maintenance',
    '/workspace/graphql': 'GraphQL Tester',
    '/workspace/protocols': 'Protocol Tester',
    '/workspace/performance-tests': 'Performance Tests',
    '/workspace/compliance': 'Compliance',
    '/workspace/settings': 'Settings',
    '/workspace/history': 'History',
    '/alerts': 'Alerts Dashboard',
    '/alerts/policies': 'Alert Policies',
    '/status': 'Status',
    '/documentation': 'Documentation',
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

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ${APP_NAME}`;
  }, [location.pathname]);

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = async () => {
      try {
        // Updated to use the full URL like other API calls in the application
        const res = await fetch('http://localhost:5001/api/auth/check', {
          credentials: 'include' // Include credentials for CORS requests
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
            profileIcon: data.user.profileIcon
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
      <div className="App" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1a2e'
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #4a9eff',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Navbar isAuthenticated={isAuthenticated} />  {/* Pass isAuthenticated to Navbar */}
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/workspace" /> : <PublicHome />} />
        <Route path="/workspace/*" element={isAuthenticated ? <Workspace /> : <Navigate to="/" />} />
        <Route path="/alerts" element={isAuthenticated ? <AlertsDashboard /> : <Navigate to="/" />} />
        <Route path="/alerts/policies" element={isAuthenticated ? <AlertPolicyEditor /> : <Navigate to="/" />} />
        <Route path="/status" element={<PublicStatusPage />} />
        <Route path="/status/:workspaceId" element={<EnhancedPublicStatusPage />} />
        <Route path="/documentation" element={<DocumentationOverview />} /> {/* Add the documentation route */}
        <Route path="/oauth/callback" element={<OAuthCallback />} /> {/* OAuth callback route */}
        <Route path="*" element={<div className="not-found-container" style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
          <h2>404 - Page Not Found</h2>
          <p>The page you're looking for doesn't exist.</p>
          <p>If you're trying to access a mock API endpoint, please use an API client like Postman or make the request programmatically.</p>
          <a href="/" style={{ color: '#4a9eff', textDecoration: 'underline' }}>Go to Home</a>
        </div>} />
      </Routes>
      <ToastContainer
        theme="dark"
        position="bottom-right"
        autoClose={2800}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        icon
      />
      {/* api-network is a fixed-height app-shell that renders its own footer inside
          the scroll region — a second global footer here would create a 2nd scrollbar */}
      {!location.pathname.startsWith('/workspace/api-network') && <Footer />}
    </div>
  );
}

export default App;