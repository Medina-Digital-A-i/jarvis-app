import { SITES } from '@/data/sites';
import { useActiveSite } from '@/lib/store';

export default function SiteSwitcher() {
  const [active, setActive] = useActiveSite();
  return (
    <div className="flex items-center gap-1.5 p-1 border border-line rounded-md bg-cyan/[0.04]">
      {SITES.map((s) => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-[12px] tracking-[0.12em] uppercase rounded transition-all ${
              isActive
                ? 'text-amber bg-amber/[0.12]'
                : 'text-ink-soft hover:text-ink hover:bg-cyan/[0.08]'
            }`}
            style={isActive ? { boxShadow: '0 0 18px rgba(255,165,0,0.45), inset 0 0 8px rgba(255,165,0,0.2)', textShadow: '0 0 8px rgba(255,165,0,0.45)' } : {}}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-ink-dim'}`}
              style={isActive ? { boxShadow: '0 0 8px #00FF88' } : {}}
            />
            <span>{s.name}</span>
          </button>
        );
      })}
      <button className="flex items-center gap-2 px-4 py-2 font-mono text-[12px] tracking-[0.12em] uppercase rounded text-ink-soft hover:text-ink hover:bg-cyan/[0.08] transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-amber" style={{ boxShadow: '0 0 8px #FFA500' }} />
        <span>+ Add Site</span>
      </button>
    </div>
  );
}
