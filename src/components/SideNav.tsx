import { NavLink } from 'react-router-dom';
import { useSidebarCollapsed } from '@/lib/store';

type Item = { to: string; label: string; ico: string; badge?: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: 'SEO Command Center',
    items: [
      { to: '/', label: 'Dashboard', ico: '📊', badge: 'LIVE' },
      { to: '/agents', label: 'Agent Ops', ico: '🛰️', badge: 'LIVE' },
      { to: '/seo-health', label: 'SEO Health', ico: '⊕' },
      { to: '/competitors', label: 'Competitors', ico: '🏁' },
      { to: '/blog-manager', label: 'Blog Manager', ico: '✎' },
      { to: '/agent-activity', label: 'Agent Activity', ico: '🤖' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/settings', label: 'Settings', ico: '⚙' }],
  },
];

export default function SideNav({ collapsed = false }: { collapsed?: boolean }) {
  const [, setCollapsed] = useSidebarCollapsed();

  return (
    <aside
      className="hidden lg:flex shrink-0 border-r border-line p-3 overflow-y-auto bg-bg-mid/40 flex-col transition-[width] duration-200"
      style={{ width: collapsed ? 72 : 248 }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="self-end mb-2 w-7 h-7 grid place-items-center rounded-md border border-line text-ink-dim hover:text-blue hover:border-blue/50 transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Search Console live indicator */}
      {!collapsed && (
        <div className="mb-5 mx-1 px-3 py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06]">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-emerald-400/80 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-led-pulse" />
            Search Console · Live
          </div>
          <div className="text-[10px] text-ink-soft/70 leading-relaxed">
            Live keyword rankings are connected and flowing.
          </div>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          {!collapsed && (
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ink-dim px-2.5 pb-2 mb-2 border-b border-dashed border-line">
              {group.label}
            </div>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] mb-0.5 transition-all border ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'text-white border-blue/40 bg-blue/[0.12] shadow-glow-soft'
                    : 'text-ink-soft border-transparent hover:text-blue hover:bg-blue/[0.06] hover:border-line'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="w-5 h-5 grid place-items-center text-sm shrink-0">{item.ico}</span>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span
                      className={`ml-auto px-2 py-[1px] font-mono text-[9px] rounded-md border tracking-wider ${
                        isActive
                          ? 'bg-blue/20 text-blue-soft border-blue/40'
                          : 'bg-blue/[0.12] text-blue border-blue/25'
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

      {!collapsed && (
        <div className="mt-auto pt-4 border-t border-line mx-1">
          <div className="font-mono text-[9px] tracking-widest uppercase text-ink-dim/60 px-2">
            TPS Pro LLC · SEO Engine
          </div>
          <div className="font-mono text-[9px] text-ink-dim/50 px-2 mt-0.5">
            v2.0 · jarvis-app-orpin.vercel.app
          </div>
        </div>
      )}
    </aside>
  );
}
