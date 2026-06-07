import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Rankings from '@/pages/Rankings';
import SeoHealth from '@/pages/SeoHealth';
import AgentActivity from '@/pages/AgentActivity';
import BlogManager from '@/pages/BlogManager';
import Competitors from '@/pages/Competitors';
import Stub from '@/pages/Stub';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Main: Rankings Dashboard */}
        <Route index element={<Rankings />} />

        {/* SEO Command Center */}
        <Route path="/seo-health" element={<SeoHealth />} />
        <Route path="/agent-activity" element={<AgentActivity />} />
        <Route path="/blog-manager" element={<BlogManager />} />
        <Route path="/competitors" element={<Competitors />} />

        {/* Settings */}
        <Route path="/settings" element={
          <Stub title="Settings" meta="Account · API keys · team"
            description="Per-site and account-wide configuration. Team member access, API credentials, billing."
            todo={['Per-site config (domain, brand, contact)', 'Team member roles', 'API credential vault (encrypted)', 'Audit log']}
          />
        } />

        {/* Catch-all */}
        <Route path="*" element={
          <Stub title="404" meta="Route not found"
            description="That page isn't wired up yet. Use the side nav to get back."
            todo={['Pick a section from the left nav']}
          />
        } />
      </Route>
    </Routes>
  );
}
