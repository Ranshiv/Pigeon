// client/src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import { CollaborationProvider } from './context/CollaborationContext';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    <CollaborationProvider>
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
        <Footer />
      </div>
    </CollaborationProvider>
  );
}

export default App;