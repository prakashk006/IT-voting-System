import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Dynamic API Routing for production deployments (e.g. Vercel Frontend + Render Backend)
const BACKEND_URL = import.meta.env.VITE_API_URL || '';
if (BACKEND_URL) {
  // Override global fetch to automatically prefix all relative API requests
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    if (typeof url === 'string' && (url.startsWith('/api') || url.startsWith('api'))) {
      const separator = url.startsWith('/') ? '' : '/';
      url = `${BACKEND_URL}${separator}${url}`;
    }
    return originalFetch(url, options);
  };
}

// Global helper to map uploaded assets to the correct backend host
window.getAssetUrl = (url) => {
  if (url && url.startsWith('/uploads')) {
    return `${BACKEND_URL}${url}`;
  }
  return url;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
