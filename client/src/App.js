// client/src/App.js
import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Workspace from './components/Workspace';
import './App.css';

function App() {
  const navigate = useNavigate();

  return (
    <div className="App">
      <Navbar /> {/* Only one Navbar here */}
      <div className="container">
        <Routes>
          <Route path="/" element={<Home onGetStarted={() => navigate('/workspace')} />} />
          <Route path="/workspace/*" element={<Workspace />} />
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;