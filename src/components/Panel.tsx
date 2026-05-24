import { ReactNode } from 'react';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function PanelHead({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="panel-title">{title}</div>
      <div className="flex items-center gap-3">
        {meta && <div className="panel-meta">{meta}</div>}
        {right}
      </div>
    </div>
  );
}

export function PanelBody({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <div className={padded ? 'p-5' : ''}>{children}</div>;
}
