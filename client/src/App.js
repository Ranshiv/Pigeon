// client/src/App.js
import React from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'; // Import Navigate
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Workspace from './components/Workspace';
import './App.css';

function App() {
  const navigate = useNavigate();

  return (
    <div className="App">
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home onGetStarted={() => navigate('/workspace')} />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/workspace/*" element={<Workspace />} />
          {/* Add this redirect route */}
          <Route path="/requests" element={<Navigate to="/workspace/explore" />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;