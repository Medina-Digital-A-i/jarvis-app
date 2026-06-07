import { ReactNode } from 'react';

export default function PageHead({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6 pb-4 border-b border-line">
      <div>
        <div
          className="font-mono text-[26px] font-bold text-white tracking-[0.04em] flex items-center gap-3.5"
          style={{ textShadow: '0 0 14px rgba(59,130,246,0.3)' }}
        >
          <span
            className="block w-3 h-7 rounded-sm"
            style={{ background: 'linear-gradient(180deg, #3B82F6, transparent)', boxShadow: '0 0 12px rgba(59,130,246,0.5)' }}
          />
          {title}
        </div>
        {meta && (
          <div className="font-mono text-[11px] text-ink-dim tracking-[0.12em] uppercase mt-1.5">{meta}</div>
        )}
      </div>
      {actions && <div className="flex gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}
