import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { POSTS } from '@/data/mock';

const STATUS_TONE: Record<string, string> = {
  published: 'text-success border-success/30 bg-success/[0.06]',
  draft: 'text-amber border-amber/40 bg-amber/[0.08]',
  scheduled: 'text-cyan border-cyan/40 bg-cyan/[0.08]',
};

export default function Blog() {
  return (
    <>
      <PageHead
        title="Blog · Content"
        meta="Drafts, schedules, and live posts across this site"
        actions={
          <>
            <button className="btn">📅 Calendar View</button>
            <button className="btn btn-primary">+ Write Post</button>
          </>
        }
      />
      <Panel>
        <PanelHead title="Posts" meta={`${POSTS.length} TOTAL · ${POSTS.filter(p => p.status === 'published').length} LIVE`} />
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-mono tracking-[0.16em] uppercase text-ink-dim border-b border-line">
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Views</th>
            </tr>
          </thead>
          <tbody>
            {POSTS.map((p, i) => (
              <tr key={p.id} className={i < POSTS.length - 1 ? 'border-b border-dashed border-line' : ''}>
                <td className="px-5 py-4 text-ink font-semibold">{p.title}</td>
                <td className="px-5 py-4">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border ${STATUS_TONE[p.status]}`}>
                    {p.status === 'published' ? '● PUBLISHED' : p.status === 'scheduled' ? '◷ SCHEDULED' : '◐ DRAFT'}
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-[12px] text-ink-soft">{p.scheduled || '—'}</td>
                <td className="px-5 py-4 text-right font-mono text-ink">{p.views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
