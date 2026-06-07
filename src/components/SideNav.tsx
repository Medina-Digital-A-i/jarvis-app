import { NavLink } from 'react-router-dom';

type Item = { to: string; label: string; ico: string; badge?: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: 'SEO Command Center',
    items: [
      { to: '/', label: 'Rankings', ico: '📊', badge: 'LIVE' },
      { to: '/seo-health', label: 'SEO Health', ico: '⊕' },
      { to: '/agent-activity', label: 'Agent Activity', ico: '🤖' },
      { to: '/blog-manager', label: 'Blog Manager', ico: '✎' },
      { to: '/competitors', label: 'Competitors', ico: '🏁' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', ico: '⚙' },
    ],
  },
];

export default function SideNav() {
  return (
    <aside
      className="border-r border-line p-6 overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, rgba(17,23,58,0.4), rgba(10,14,39,0.8))' }}
    >
      {/* Service account reminder */}
      <div className="mb-6 px-3 py-2.5 rounded-lg border border-amber/20 bg-amber/[0.05]">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-amber/70 mb-1">GSC Access Needed</div>
        <div className="text-[10px] text-white/40 leading-relaxed">
          Grant service account in Search Console to activate live rankings.
        </div>
      </div>

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

      {/* Bottom info */}
      <div className="mt-4 pt-4 border-t border-line/50">
        <div className="font-mono text-[9px] tracking-widest uppercase text-white/15 px-2">
          TPS Pro LLC · SEO Engine
        </div>
        <div className="font-mono text-[9px] text-white/15 px-2 mt-0.5">
          v2.0 · jarvis-app-orpin.vercel.app
        </div>
      </div>
    </aside>
  );
}
