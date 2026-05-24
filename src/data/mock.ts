// Mock data feeding the Phase 1 dashboard widgets.
// Replace with real API calls once backend is wired.

export const ACTIVITY_FEED = [
  { id: 1, kind: 'lead' as const, text: 'New lead: Angela H. · Albany office cleanup', meta: '2 min ago · GA4 form' },
  { id: 2, kind: 'review' as const, text: 'Google review (★★★★★) — "Best deep clean we\'ve had"', meta: '17 min ago · Google Business' },
  { id: 3, kind: 'social' as const, text: 'Phoebe published Instagram post · Pour Decisions', meta: '42 min ago · Auto-scheduled' },
  { id: 4, kind: 'alert' as const, text: 'Page speed dropped on /services · -12% LCP', meta: '1 hr ago · Search Console' },
  { id: 5, kind: 'email' as const, text: 'Email campaign opened by 38 of 142 recipients (26.7%)', meta: '2 hr ago · ConvertKit' },
];

export const INTEGRATIONS = [
  { id: 'ga4', name: 'Google Analytics', icon: 'G', connected: true },
  { id: 'gbp', name: 'Business Profile', icon: 'B', connected: true },
  { id: 'ads', name: 'Google Ads', icon: '$', connected: true },
  { id: 'gsc', name: 'Search Console', icon: '⌕', connected: true },
  { id: 'sheets', name: 'Sheets', icon: '⊞', connected: true },
  { id: 'cal', name: 'Calendar', icon: '📅', connected: true },
  { id: 'gmail', name: 'Gmail', icon: '✉', connected: true },
  { id: 'drive', name: 'Drive', icon: '▣', connected: true },
  { id: 'ig', name: 'Instagram', icon: '@', connected: true },
  { id: 'fb', name: 'Facebook', icon: 'f', connected: true },
  { id: 'stripe', name: 'Stripe', icon: '$', connected: true },
  { id: 'hubspot', name: 'HubSpot', icon: 'H', connected: true },
  { id: 'tiktok', name: 'TikTok', icon: 'T', connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', connected: false },
];

export const AGENTS = [
  { id: 'phoebe', name: 'Phoebe', avatarChar: 'P', task: 'Monitoring → Pour Decisions site speed', status: 'live' as const },
  { id: 'claude', name: 'Claude', avatarChar: 'C', task: 'Drafting → Q3 outreach email sequence', status: 'live' as const },
  { id: 'diana', name: 'Diana', avatarChar: 'D', task: 'Receptionist · ready for inbound', status: 'idle' as const },
];

export const TASKS = [
  { id: 1, text: 'Push Pour Decisions logo update across all platforms', tag: 'DONE', done: true },
  { id: 2, text: 'Apply TPS Pro icon to TPS120 application', tag: 'DONE', done: true },
  { id: 3, text: 'Approve Jarvis dashboard design (this preview)', tag: 'YOU', done: false, accent: 'amber' as const },
  { id: 4, text: 'Connect TikTok & LinkedIn API credentials', tag: 'SETUP', done: false, accent: 'cyan' as const },
  { id: 5, text: 'Review 23 leads in pipeline · assign owners', tag: 'CRM', done: false, accent: 'gold' as const },
  { id: 6, text: 'Install Google Drive for Desktop', tag: 'DONE', done: true },
  { id: 7, text: 'Generate full TPS Pro icon format package', tag: 'DONE', done: true },
];

export const PAGES = [
  { id: 'home', name: 'Home', updated: '2 days ago', status: 'live' as const },
  { id: 'about', name: 'About', updated: '1 wk ago', status: 'live' as const },
  { id: 'services', name: 'Services', updated: '3 days ago', status: 'live' as const },
  { id: 'contact', name: 'Contact', updated: '5 days ago', status: 'live' as const },
  { id: 'pricing', name: 'Pricing', updated: '4 days ago', status: 'draft' as const },
];

export const LEADS = [
  { id: 1, name: 'Angela Hamm', email: 'angela@example.com', source: 'Form · /contact', stage: 'New', value: '$2,400', updated: '12 min ago' },
  { id: 2, name: 'Jeff Jiang', email: 'jeff@example.com', source: 'Google Ads', stage: 'Qualified', value: '$8,900', updated: '2 hr ago' },
  { id: 3, name: 'Hoosick Manor', email: 'pm@hoosick.example', source: 'Referral', stage: 'Proposal Sent', value: '$14,200', updated: '1 day ago' },
  { id: 4, name: 'Lance Properties', email: 'ops@lance.example', source: 'Phone', stage: 'Won', value: '$3,800', updated: '3 days ago' },
  { id: 5, name: 'Clark Cohn', email: 'clark@cohn.example', source: 'Form · /quote', stage: 'New', value: '$1,800', updated: '5 hr ago' },
];

export const POSTS = [
  { id: 1, title: '5 Greens Every Beginner Should Be Pouring', status: 'published' as const, scheduled: '2026-04-28', views: 1248 },
  { id: 2, title: 'Ginger vs. Turmeric: When to Reach for Each', status: 'published' as const, scheduled: '2026-04-22', views: 892 },
  { id: 3, title: 'Why We Press Daily and Refuse to Bottle', status: 'draft' as const, scheduled: null, views: 0 },
  { id: 4, title: 'Spring Detox Pour-Pack Drop', status: 'scheduled' as const, scheduled: '2026-05-09', views: 0 },
];
