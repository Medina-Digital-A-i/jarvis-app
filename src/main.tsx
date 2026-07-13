import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './styles.css';

// Clerk auth gate — fail-open when unconfigured so the app stays deployable
// until the owner adds his publishable key in Vercel env.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn(
    '[JARVIS] No VITE_CLERK_PUBLISHABLE_KEY set — dashboard is UNSECURED (public). Add the key in Vercel env to lock it down.'
  );
}

// HashRouter so the built `dist/` works when opened directly from the filesystem
// (file://) — no server needed. Switch to BrowserRouter once deployed to Vercel/
// Netlify if you want clean URLs (those hosts handle SPA fallback).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      ) : (
        <App />
      )}
    </HashRouter>
  </React.StrictMode>
);
