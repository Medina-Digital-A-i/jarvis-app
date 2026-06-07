import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteSwitcher from './SiteSwitcher';
import { useSiteHealth } from '@/lib/store';

export default function TopBar() {
  const [clock, setClock] = useState(formatNow());
  const [health] = useSiteHealth();
  const navigate = useNavigate();
  const score = health?.score ?? 92;
  const scoreColor = score >= 80 ? 'text-success' : score >= 60 ? 'text-amber' : 'text-alert';
  useEffect(() => {
    const id = setInterval(() => setClock(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-5 px-6 py-3 border-b border-line backdrop-blur-md bg-bg-deep/80">
      <div
        className="flex items-center gap-2.5 text-[20px] font-bold tracking-[0.18em] text-white"
        style={{ textShadow: '0 0 14px rgba(59,130,246,0.5)' }}
      >
        <div className="reactor" />
        <span className="font-mono">JARVIS</span>
      </div>

      <SiteSwitcher />

      <div className="flex-1" />

      {/* Site health score + last crawl */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-line bg-bg-mid/60">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">Health</span>
          <span className="font-mono text-[15px] font-bold text-success leading-none">92</span>
          <span className="font-mono text-[10px] text-ink-dim">/100</span>
        </div>
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-bg-mid/60 font-mono text-[10px] text-ink-soft">
          <span className="led" />
          <span>Last crawl {clock}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="hidden md:flex items-center gap-2">
        <button className="btn" onClick={() => navigate('/')} title="Refresh rankings">⟳ Refresh</button>
        <button className="btn btn-primary" onClick={() => navigate('/chat')}>✦ Ask JARVIS</button>
      </div>

      <div className="flex items-center gap-2.5 px-2 py-1 pl-3 border border-line rounded-full text-[12px] text-ink">
        <div
          className="w-7 h-7 rounded-full grid place-items-center font-mono font-extrabold text-white text-[13px]"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
        >
          M
        </div>
        <span className="hidden sm:inline">Miguel</span>
      </div>
    </header>
  );
}

function formatNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} EDT`;
}
