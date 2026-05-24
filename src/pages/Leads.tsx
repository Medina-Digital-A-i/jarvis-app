import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { LEADS } from '@/data/mock';

const STAGE_TONE: Record<string, string> = {
  New: 'text-cyan border-cyan/40 bg-cyan/[0.08]',
  Qualified: 'text-amber border-amber/40 bg-amber/[0.08]',
  'Proposal Sent': 'text-gold border-gold/40 bg-gold/[0.08]',
  Won: 'text-success border-success/30 bg-success/[0.08]',
  Lost: 'text-alert border-alert/30 bg-alert/[0.08]',
};

export default function Leads() {
  return (
    <>
      <PageHead
        title="Leads · CRM"
        meta="Pipeline · sources synced from Forms / Ads / Phone / Referral"
        actions={
          <>
            <button className="btn">📤 Export CSV</button>
            <button className="btn btn-primary">+ Add Lead</button>
          </>
        }
      />
      <Panel>
        <PanelHead title="Open Pipeline" meta={`${LEADS.length} ACTIVE`} />
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-mono tracking-[0.16em] uppercase text-ink-dim border-b border-line">
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Stage</th>
              <th className="px-5 py-3 text-right">Value</th>
              <th className="px-5 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {LEADS.map((l, i) => (
              <tr key={l.id} className={i < LEADS.length - 1 ? 'border-b border-dashed border-line' : ''}>
                <td className="px-5 py-4">
                  <div className="text-ink font-semibold">{l.name}</div>
                  <div className="text-[12px] text-ink-soft font-mono">{l.email}</div>
                </td>
                <td className="px-5 py-4 font-mono text-[12px] text-ink-soft">{l.source}</td>
                <td className="px-5 py-4">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border ${STAGE_TONE[l.stage] || ''}`}>
                    {l.stage}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-mono text-ink font-bold">{l.value}</td>
                <td className="px-5 py-4 font-mono text-[12px] text-ink-soft">{l.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
