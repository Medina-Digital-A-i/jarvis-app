import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CommandBar() {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const navigate = useNavigate();

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

  const send = () => {
    const q = value.trim();
    if (!q) return;
    setValue('');
    // Hand the prompt to the chat page, which auto-sends it on arrival.
    navigate('/chat', { state: { prefill: q } });
  };

  return (
    <div
      className="fixed bottom-[5.5rem] lg:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-3 rounded-full border border-blue/40 backdrop-blur-md bg-bg-mid/90"
      style={{
        width: 560,
        maxWidth: 'calc(100vw - 48px)',
        boxShadow: '0 16px 60px rgba(0,0,0,0.6), 0 0 28px rgba(59,130,246,0.18)',
      }}
    >
      <span className="font-mono font-bold text-blue px-2 select-none" style={{ textShadow: '0 0 8px rgba(59,130,246,0.5)' }}>
        ✦ JARVIS &gt;
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder='Ask anything · "write a blog post" · "what should I fix today?"'
        className="flex-1 bg-transparent outline-none border-0 text-[13px] text-ink placeholder:text-ink-dim"
      />
      <span className="hidden sm:inline font-mono text-[10px] text-ink-dim px-2 py-0.5 border border-line rounded">⌘K</span>
    </div>
  );
}
