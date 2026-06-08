import { SITES } from '@/data/sites';
import { useActiveSite } from '@/lib/store';

export default function SiteSwitcher() {
  const [active, setActive] = useActiveSite();
  return (
    <div className="flex items-center gap-1 p-1 border border-line rounded-lg bg-bg-mid/60 shrink min-w-0 overflow-x-auto">
      {SITES.map((s) => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`shrink-0 flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 font-mono text-[11px] tracking-[0.1em] uppercase rounded-md transition-all ${
              isActive
                ? 'text-white bg-blue/15 border border-blue/40'
                : 'text-ink-soft border border-transparent hover:text-ink hover:bg-white/[0.04]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-ink-dim'}`}
              style={isActive ? { boxShadow: '0 0 8px #22C55E' } : {}}
            />
            <span>{s.name}</span>
          </button>
        );
      })}
      <button className="hidden sm:flex shrink-0 items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.1em] uppercase rounded-md text-ink-soft border border-transparent hover:text-blue hover:bg-blue/[0.06] transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-blue" style={{ boxShadow: '0 0 8px #3B82F6' }} />
        <span>+ Add Site</span>
      </button>
    </div>
  );
}
