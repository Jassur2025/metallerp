import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installGlobalErrorHandlers } from './utils/logger';
import { initSentry } from './lib/sentry';
import { initializeAppCheckService } from './lib/appCheck';

// Initialise Sentry BEFORE anything else (no-ops if DSN not set)
initSentry();

// Initialize Firebase App Check (no-ops if site key not set)
initializeAppCheckService();

// Capture unhandled errors/rejections globally
installGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);