// client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { FontProvider } from './context/FontContext'; // Import FontProvider
import { CollaborationProvider } from './context/CollaborationContext'; // Import CollaborationProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <FontProvider> {/* Wrap with FontProvider */}
          <CollaborationProvider> {/* Wrap with CollaborationProvider */}
            <App />
          </CollaborationProvider>
        </FontProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);