// client/src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'; // Import Navigate
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Workspace from './components/Workspace';
import PublicHome from './components/PublicHome'; // Import the new PublicHome component
import CustomCursor from './components/CustomCursor'; // Import the CustomCursor component
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        setIsAuthenticated(data.isAuthenticated);
      } catch (err) {
        console.error("Error checking auth:", err);
        setIsAuthenticated(false); // Assume not authenticated on error
      }
    };

    checkAuth();
  }, []);


  return (
    <div className="App">
      <CustomCursor /> {/* Add the CustomCursor component */}
      <Navbar isAuthenticated={isAuthenticated} />  {/* Pass isAuthenticated to Navbar */}
      <div className="container">
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/workspace" /> : <PublicHome />} />
          <Route path="/workspace/*" element={isAuthenticated ? <Workspace /> : <Navigate to="/" />} />
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;