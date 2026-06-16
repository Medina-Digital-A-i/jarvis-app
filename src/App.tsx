import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Rankings from '@/pages/Rankings';
import SeoHealth from '@/pages/SeoHealth';
import AgentActivity from '@/pages/AgentActivity';
import AgentOps from '@/pages/AgentOps';
import GetToOne from '@/pages/GetToOne';
import Console from '@/pages/Console';
import AiEditor from '@/pages/AiEditor';
import Ads from '@/pages/Ads';
import Local from '@/pages/Local';
import BlogManager from '@/pages/BlogManager';
import Competitors from '@/pages/Competitors';
import Settings from '@/pages/Settings';
import Stub from '@/pages/Stub';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Main: Rankings Dashboard */}
        <Route index element={<Rankings />} />

        {/* SEO Command Center */}
        <Route path="/get-to-1" element={<GetToOne />} />
        <Route path="/console" element={<Console />} />
        <Route path="/edit" element={<AiEditor />} />
        <Route path="/ads" element={<Ads />} />
        <Route path="/local" element={<Local />} />
        <Route path="/agents" element={<AgentOps />} />
        <Route path="/seo-health" element={<SeoHealth />} />
        <Route path="/agent-activity" element={<AgentActivity />} />
        <Route path="/blog-manager" element={<BlogManager />} />
        <Route path="/competitors" element={<Competitors />} />

        {/* Settings */}
        <Route path="/settings" element={<Settings />} />

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
