// client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { FontProvider } from './context/FontContext'; // Import FontProvider
import { CollaborationProvider } from './context/CollaborationContext'; // Import CollaborationProvider

// Global ResizeObserver error handler
// This prevents ResizeObserver loop errors from showing in console during zoom/resize operations
const handleGlobalErrors = () => {
  // Create a safe ResizeObserver wrapper
  const OriginalResizeObserver = window.ResizeObserver;

  window.ResizeObserver = class SafeResizeObserver extends OriginalResizeObserver {
    constructor(callback) {
      const safeCallback = (entries, observer) => {
        requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (error) {
            // Silently ignore ResizeObserver loop errors
            if (error.message && error.message.includes('ResizeObserver loop')) {
              return;
            }
            throw error;
          }
        });
      };
      super(safeCallback);
    }
  };

  // Suppress ResizeObserver errors in console
  const originalError = window.console.error;
  window.console.error = (...args) => {
    if (
      args.length > 0 &&
      typeof args[0] === 'string' &&
      (args[0].includes('ResizeObserver loop completed with undelivered notifications') ||
        args[0].includes('ResizeObserver loop limit exceeded'))
    ) {
      // Silently ignore ResizeObserver loop errors
      return;
    }
    originalError.apply(console, args);
  };

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    if (
      event.message &&
      (event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
        event.message.includes('ResizeObserver loop limit exceeded'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Handle unhandled promise rejections that might contain ResizeObserver errors
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      event.reason.message &&
      (event.reason.message.includes('ResizeObserver loop completed') ||
        event.reason.message.includes('ResizeObserver loop limit'))
    ) {
      event.preventDefault();
      return false;
    }
  });

  // Handle script errors (for bundled code)
  const originalOnerror = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (
      message &&
      typeof message === 'string' &&
      (message.includes('ResizeObserver loop completed') ||
        message.includes('ResizeObserver loop limit'))
    ) {
      return true; // Prevent default error handling
    }
    if (originalOnerror) {
      return originalOnerror(message, source, lineno, colno, error);
    }
    return false;
  };
};

// Initialize global error handling
handleGlobalErrors();

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
