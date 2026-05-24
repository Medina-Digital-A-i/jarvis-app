import { NavLink } from 'react-router-dom';

type Item = { to: string; label: string; ico: string; badge?: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', ico: '⌬', badge: 'LIVE' },
      { to: '/quick-actions', label: 'Quick Actions', ico: '⊞' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/pages', label: 'Pages', ico: '≡', badge: '14' },
      { to: '/blog', label: 'Blog', ico: '✎', badge: '7' },
      { to: '/photos', label: 'Photos', ico: '▣' },
      { to: '/testimonials', label: 'Testimonials', ico: '★' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/analytics', label: 'Analytics', ico: '↗' },
      { to: '/seo', label: 'SEO & Meta', ico: '⊕' },
      { to: '/leads', label: 'Leads / CRM', ico: '⌕', badge: '23' },
      { to: '/reviews', label: 'Reviews', ico: '★' },
    ],
  },
  {
    label: 'Google',
    items: [
      { to: '/google/business', label: 'Business Profile', ico: 'G' },
      { to: '/google/ads', label: 'Google Ads', ico: '$' },
      { to: '/google/search-console', label: 'Search Console', ico: '📊' },
      { to: '/google/calendar', label: 'Calendar', ico: '📅' },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { to: '/email', label: 'Email Campaigns', ico: '✉' },
      { to: '/social', label: 'Social Media', ico: '@' },
      { to: '/automations', label: 'Automations', ico: '⟳' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', ico: '⚙' },
      { to: '/integrations', label: 'Integrations', ico: '⚡' },
    ],
  },
];

export default function SideNav() {
  return (
    <aside className="border-r border-line p-6 overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, rgba(17,23,58,0.4), rgba(10,14,39,0.8))' }}
    >
      {GROUPS.map((group) => (
        <div key={group.label} className="mb-6">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ink-dim px-2.5 pb-2 mb-2 border-b border-dashed border-line">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] mb-0.5 transition-all border ${
                  isActive
                    ? 'text-amber border-amber/30 bg-amber/[0.08]'
                    : 'text-ink-soft border-transparent hover:text-cyan hover:bg-cyan/[0.06] hover:border-line'
                }`
              }
              style={({ isActive }: any) =>
                isActive ? { boxShadow: 'inset 0 0 16px rgba(255,165,0,0.08)' } : {}
              }
            >
              {({ isActive }) => (
                <>
                  <span className="w-5.5 h-5.5 grid place-items-center text-sm">{item.ico}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`ml-auto px-2 py-[1px] font-mono text-[10px] rounded-lg border tracking-wider ${
                        isActive
                          ? 'bg-amber/[0.18] text-amber border-amber/40'
                          : 'bg-cyan/[0.15] text-cyan border-line'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
