import { useEffect, useState } from 'react';
import SiteSwitcher from './SiteSwitcher';

export default function TopBar() {
  const [clock, setClock] = useState(formatNow());
  useEffect(() => {
    const id = setInterval(() => setClock(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="sticky top-0 z-20 flex items-center gap-6 px-7 py-3.5 border-b border-line backdrop-blur"
      style={{ background: 'linear-gradient(180deg, rgba(17,23,58,0.85), rgba(17,23,58,0.4))' }}
    >
      <div className="flex items-center gap-3 font-mono text-[22px] font-bold text-amber tracking-[0.18em]"
        style={{ textShadow: '0 0 14px rgba(255,165,0,0.45)' }}
      >
        <div className="reactor" />
        <span>JARVIS</span>
      </div>

      <SiteSwitcher />

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line">
          <span className="led" />
          <span>System Online</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line">
          <span className="led" style={{ background: '#00D9FF', boxShadow: '0 0 10px #00D9FF' }} />
          <span>{clock}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-2 py-1 pl-3.5 border border-line rounded-full text-[12px]">
        <div className="w-7 h-7 rounded-full grid place-items-center font-mono font-extrabold text-bg-deep text-[13px]"
          style={{ background: 'linear-gradient(135deg, #FFA500, #FFD700)' }}
        >M</div>
        <span>Miguel</span>
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
