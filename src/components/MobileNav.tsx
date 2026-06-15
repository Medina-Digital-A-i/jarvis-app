import { NavLink } from 'react-router-dom';

type Item = { to: string; label: string; ico: string };

// Main destinations surfaced in the mobile bottom bar. Settings lives in the
// desktop sidebar only — keep the bar to the six primary sections so each tap
// target stays comfortably wide at 375px.
const ITEMS: Item[] = [
  { to: '/', label: 'Dashboard', ico: '📊' },
  { to: '/seo-health', label: 'Health', ico: '⊕' },
  { to: '/competitors', label: 'Rivals', ico: '🏁' },
  { to: '/blog-manager', label: 'Blog', ico: '✎' },
  { to: '/agents', label: 'Agents', ico: '🛰️' },
  { to: '/chat', label: 'Chat', ico: '✦' },
];

export default function MobileNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-line bg-bg-deep/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              isActive ? 'text-blue' : 'text-ink-soft hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="text-base leading-none"
                style={isActive ? { textShadow: '0 0 10px rgba(59,130,246,0.6)' } : {}}
              >
                {item.ico}
              </span>
              <span className="font-mono text-[9px] tracking-[0.04em] uppercase truncate max-w-full px-0.5">
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
