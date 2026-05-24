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
          className="font-mono text-[28px] font-bold text-ink tracking-[0.06em] flex items-center gap-3.5"
          style={{ textShadow: '0 0 12px rgba(0,217,255,0.3)' }}
        >
          <span
            className="block w-3 h-7 rounded-sm"
            style={{ background: 'linear-gradient(180deg, #FFA500, transparent)', boxShadow: '0 0 12px rgba(255,165,0,0.45)' }}
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
