import { Route, Routes } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
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

// When a Clerk publishable key is present the routed content is gated behind
// sign-in; when it's absent the gate is a no-op and the app renders openly.
const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  const routes = (
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

  // Fail-open: no Clerk key configured → render the app openly (unchanged).
  if (!CLERK_ENABLED) {
    return routes;
  }

  // Clerk active → signed-in users see the app; everyone else is redirected to sign in.
  return (
    <>
      <SignedIn>{routes}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
