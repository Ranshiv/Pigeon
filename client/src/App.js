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
import { clearSentryUser, setSentryUser } from './observability/sentry';
import { AnalyticsConsentBanner, AnalyticsPageTracker } from './observability/AnalyticsConsent';
import { useTheme } from './context/ThemeContext';

const APP_NAME = 'Pigeon';
const DEFAULT_DESCRIPTION = 'Pigeon is a collaborative API testing, monitoring, and automation platform for modern engineering teams.';

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
    '/workspace/monitoring/copilot': 'Incident and Monitoring Copilot',
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
    '/workspace/test-generator': 'AI Test Generator',
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
  const { theme } = useTheme();

  // The marketing home page always uses the Omni visual system. Keep the
  // user's saved workspace theme untouched and restore it on every other
  // route instead of persisting the public-page override.
  useEffect(() => {
    const themeClasses = ['light-theme', 'dark-theme', 'omni-theme', 'black-theme'];
    document.body.classList.remove(...themeClasses);

    if (isPublicLanding) {
      document.body.classList.add('omni-theme', 'dark-theme');
      return;
    }

    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.add(theme === 'dark' ? 'dark-theme' : theme, 'dark-theme');
    }
  }, [isPublicLanding, theme]);

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ${APP_NAME}`;

    const publicRoute = !location.pathname.startsWith('/workspace') &&
      !location.pathname.startsWith('/oauth') &&
      !location.pathname.startsWith('/alerts');
    const description = location.pathname === '/'
      ? DEFAULT_DESCRIPTION
      : `${pageTitle} in Pigeon.`;
    const robots = publicRoute ? 'index,follow' : 'noindex,nofollow';
    const origin = window.location.origin;

    const setMeta = (name, content) => {
      let element = document.querySelector(`meta[name="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const setProperty = (property, content) => {
      let element = document.querySelector(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('robots', robots);
    setProperty('og:title', `${pageTitle} | ${APP_NAME}`);
    setProperty('og:description', description);
    setProperty('og:url', `${origin}${location.pathname}`);
    setProperty('og:type', 'website');

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${origin}${location.pathname}`);
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
          setSentryUser({
            id: data.user._id || data.user.id,
            email: data.user.email
          });
          localStorage.setItem('user', JSON.stringify({
            id: data.user._id || data.user.id,
            displayName: data.user.displayName || data.user.name || "User",
            email: data.user.email,
            profileIcon: data.user.profileIcon,
            notificationPreferences: data.user.notificationPreferences
          }));
        } else {
          clearSentryUser();
        }
      } catch (err) {
        console.error("Error checking auth:", err);
        clearSentryUser();
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
      <div className={`App${isPublicLanding ? ' App--marketing' : ''}`} style={{ display: 'flex', height: '100vh' }}>
        <PageLoader size="lg" label="Loading..." />
      </div>
    );
  }

  return (
    <div className={`App${isPublicLanding ? ' App--marketing' : ''}`}>
      <AnalyticsPageTracker />
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
      <AnalyticsConsentBanner />
    </div>
  );
}

export default App;
