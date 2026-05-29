import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Pages from '@/pages/Pages';
import Leads from '@/pages/Leads';
import Blog from '@/pages/Blog';
import SEO from '@/pages/SEO';
import SearchConsole from '@/pages/SearchConsole';
import SeoReport from '@/pages/SeoReport';
import Stub from '@/pages/Stub';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/quick-actions" element={
          <Stub title="Quick Actions" meta="Common operations · 1-click"
            description="Single-click triggers for the operations you do daily — push social posts, schedule blog drops, sync Calendar to a content plan, generate weekly client reports."
            todo={[
              'Wire Phoebe agent triggers (run / pause / configure)',
              'Quick post composer (Instagram, Facebook, LinkedIn)',
              'One-click weekly report email to Miguel',
              'Bulk lead assign / status change',
            ]}
          />
        } />
        <Route path="/pages" element={<Pages />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/photos" element={
          <Stub title="Photos" meta="Gallery · upload, organize, deploy"
            description="Centralized media library — drag to upload, tag with site/section, push to live page galleries with a click."
            todo={['S3/Cloudflare R2 upload pipeline', 'Auto-resize + WebP conversion', 'Tag by site / section / campaign', 'Drag-and-drop reorder on live galleries']}
          />
        } />
        <Route path="/testimonials" element={
          <Stub title="Testimonials" meta="Reviews & quotes manager"
            description="Pulls Google reviews + manual quotes into one place. Curate which appear on the site, write replies, push to social."
            todo={['Google Business Profile review pull', 'Manual quote capture', 'Approval workflow', 'Auto-rotate testimonials on homepage']}
          />
        } />
        <Route path="/analytics" element={
          <Stub title="Analytics" meta="Cross-site reporting · GA4"
            description="Full GA4 wrapper — traffic, conversions, sources, top pages, country/device breakdown. Comparison across both sites in one view."
            todo={['GA4 OAuth + property selection', 'Real-time visitor counter', 'Conversion funnel builder', 'Cross-site comparison view']}
          />
        } />
        <Route path="/seo" element={<SEO />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/reviews" element={
          <Stub title="Reviews" meta="Google · Yelp · Manual"
            description="Multi-source review inbox — Google Business, Yelp, Facebook. Reply from one place. Auto-thank-you flows for 5★."
            todo={['Google Business Profile reviews API', 'Yelp Fusion API', 'Reply templates per rating', 'Auto-DM 5-star reviewers']}
          />
        } />
        <Route path="/google/business" element={
          <Stub title="Google Business Profile" meta="Hours · posts · Q&A · photos"
            description="Edit GBP listing without leaving Jarvis — hours, services, photos, posts, Q&A."
            todo={['GBP API auth flow', 'Hours/service editor', 'Post scheduler', 'Photo manager + analytics']}
          />
        } />
        <Route path="/google/ads" element={
          <Stub title="Google Ads" meta="Campaigns · keywords · spend"
            description="Live campaign control — budgets, bids, keywords, ad copy. Pause/resume from the dashboard."
            todo={['Google Ads API OAuth', 'Campaign list w/ key metrics', 'Keyword performance + bid editor', 'Ad-copy A/B testing UI']}
          />
        } />
        <Route path="/google/search-console" element={<SearchConsole />} />
        <Route path="/google/seo-report" element={<SeoReport />} />
        <Route path="/google/calendar" element={
          <Stub title="Calendar" meta="Content + ops calendar"
            description="Unified content calendar — blog posts, social drops, email campaigns, and ops events all in one timeline."
            todo={['Google Calendar API OAuth', 'Content calendar overlay', 'Drag-and-drop scheduling', 'Cross-site color coding']}
          />
        } />
        <Route path="/email" element={
          <Stub title="Email Campaigns" meta="ConvertKit / Mailchimp / Resend"
            description="Email blast composer + list management + automation rules. Pull leads from CRM, send segmented campaigns."
            todo={['ESP integration (ConvertKit/Resend)', 'Campaign composer with templates', 'Segmented sends from CRM', 'Open/click tracking back into Jarvis']}
          />
        } />
        <Route path="/social" element={
          <Stub title="Social Media" meta="IG · FB · LinkedIn · Twitter · TikTok"
            description="One composer, multi-channel publish. Schedule, queue, and track engagement across all connected platforms."
            todo={['Meta Graph API auth', 'Composer with media + per-channel preview', 'Best-time-to-post algorithm', 'Engagement feed (likes/comments/DMs)']}
          />
        } />
        <Route path="/automations" element={
          <Stub title="Automations" meta="Triggers · conditions · actions"
            description="Visual workflow builder — when X happens, do Y. Connect any integration to any other."
            todo={['Visual workflow editor (nodes + edges)', 'Library of pre-built recipes', 'Phoebe agent triggers', 'Run history + debugger']}
          />
        } />
        <Route path="/settings" element={
          <Stub title="Settings" meta="Account · billing · team · API keys"
            description="Per-site and account-wide configuration. Team member access, API credentials, billing."
            todo={['Per-site config (domain, brand, contact)', 'Team member roles', 'API credential vault (encrypted)', 'Audit log']}
          />
        } />
        <Route path="/integrations" element={
          <Stub title="Integrations" meta="14 connected · OAuth flows"
            description="Connect, disconnect, and authenticate all third-party services. View connection health."
            todo={['Per-integration OAuth flows', 'Connection health monitor', 'Webhook delivery logs', 'Disconnect / re-auth flow']}
          />
        } />
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
