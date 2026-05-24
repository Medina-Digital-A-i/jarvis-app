import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// HashRouter so the built `dist/` works when opened directly from the filesystem
// (file://) — no server needed. Switch to BrowserRouter once deployed to Vercel/
// Netlify if you want clean URLs (those hosts handle SPA fallback).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
