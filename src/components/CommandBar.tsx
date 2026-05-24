import { useEffect, useRef } from 'react';

export default function CommandBar() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4.5 py-3.5 rounded-full border backdrop-blur"
      style={{
        width: 540,
        maxWidth: 'calc(100vw - 48px)',
        background: 'linear-gradient(180deg, #11173A, #0A0E27)',
        borderColor: 'rgba(0,217,255,0.42)',
        boxShadow: '0 16px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,217,255,0.18)',
      }}
    >
      <span
        className="font-mono font-bold text-amber px-3"
        style={{ textShadow: '0 0 6px rgba(255,165,0,0.45)' }}
      >
        ⌁ JARVIS &gt;
      </span>
      <input
        ref={ref}
        type="text"
        placeholder='Ask anything · "post a juice bar update" · "show me last week leads"'
        className="flex-1 bg-transparent outline-none border-0 font-mono text-[13px] text-ink placeholder:text-ink-dim"
      />
      <span className="font-mono text-[10px] text-ink-dim px-2 py-0.5 border border-line rounded">⌘K</span>
    </div>
  );
}
