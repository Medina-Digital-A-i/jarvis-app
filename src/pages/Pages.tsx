import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { PAGES } from '@/data/mock';
import { getSite } from '@/data/sites';
import { useActiveSite } from '@/lib/store';

export default function Pages() {
  const [activeId] = useActiveSite();
  const site = getSite(activeId);
  return (
    <>
      <PageHead
        title={`Pages · ${site.name}`}
        meta="Site content · drag to reorder · click to edit"
        actions={<button className="btn btn-primary">+ New Page</button>}
      />
      <Panel>
        <PanelHead title="Site Pages" meta={`${PAGES.length} TOTAL`} />
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-mono tracking-[0.16em] uppercase text-ink-dim border-b border-line">
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {PAGES.map((p, i) => (
              <tr key={p.id} className={i < PAGES.length - 1 ? 'border-b border-dashed border-line' : ''}>
                <td className="px-5 py-4 text-ink font-semibold">{p.name}</td>
                <td className="px-5 py-4">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border ${
                      p.status === 'live'
                        ? 'text-success border-success/30 bg-success/[0.06]'
                        : 'text-amber border-amber/40 bg-amber/[0.08]'
                    }`}
                  >
                    {p.status === 'live' ? '● LIVE' : '◐ DRAFT'}
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-[12px] text-ink-soft">{p.updated}</td>
                <td className="px-5 py-4 text-right">
                  <button className="btn">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
