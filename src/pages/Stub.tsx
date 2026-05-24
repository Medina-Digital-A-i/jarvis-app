import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

type Props = {
  title: string;
  meta?: string;
  description: string;
  todo: string[];
};

/**
 * Section stub used for pages we'll implement in later iterations.
 * Keeps the navigation/layout fully working while showing what's coming.
 */
export default function Stub({ title, meta, description, todo }: Props) {
  return (
    <>
      <PageHead title={title} meta={meta} />
      <Panel>
        <PanelHead title="Coming in Next Iteration" meta="STUB" />
        <div className="p-6">
          <p className="text-ink-soft text-sm leading-relaxed mb-5 max-w-2xl">{description}</p>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim mb-3">Roadmap</div>
          <ul className="space-y-2.5">
            {todo.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] text-ink">
                <span className="font-mono text-[11px] text-cyan mt-0.5">[{String(i + 1).padStart(2, '0')}]</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </>
  );
}
