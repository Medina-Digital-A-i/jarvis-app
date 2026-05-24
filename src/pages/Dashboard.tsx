import PageHead from '@/components/PageHead';
import KpiCard from '@/components/KpiCard';
import { Panel, PanelHead } from '@/components/Panel';
import { ACTIVITY_FEED, AGENTS, INTEGRATIONS, TASKS } from '@/data/mock';
import { getSite } from '@/data/sites';
import { useActiveSite } from '@/lib/store';

export default function Dashboard() {
  const [activeId] = useActiveSite();
  const site = getSite(activeId);

  return (
    <>
      <PageHead
        title={`Dashboard · ${site.name}`}
        meta={`CMD CENTER · Last sync: 12 sec ago · ${site.domain}`}
        actions={
          <>
            <button className="btn">⟳ Refresh</button>
            <button className="btn">📤 Export</button>
            <button className="btn btn-primary">+ New Action</button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiCard
          tone="amber"
          label="Visitors / 30d"
          value={site.metrics.visitors30d}
          delta={`${site.metrics.visitorsDelta} vs prev 30d`}
          spark={[20, 34, 28, 46, 52, 38, 64, 76, 88, 72, 90, 96]}
        />
        <KpiCard
          label="Leads This Week"
          value={site.metrics.leadsWeek}
          delta={site.metrics.leadsDelta}
          spark={[30, 50, 62, 48, 70, 84, 100]}
        />
        <KpiCard
          tone="gold"
          label="Conversion Rate"
          value={
            <>
              {site.metrics.conversionRate.replace('%', '')}
              <span className="text-sm text-ink-dim ml-1.5">%</span>
            </>
          }
          delta={site.metrics.conversionDelta}
          spark={[40, 50, 46, 56, 62, 60, 72, 78, 82]}
        />
        <KpiCard
          tone="amber"
          label="Pipeline Value"
          value={site.metrics.pipelineValue}
          delta={site.metrics.pipelineDelta}
          spark={[30, 42, 38, 56, 64, 72, 78, 88, 94]}
        />
      </div>

      {/* Chart + Live Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-7">
        <Panel>
          <PanelHead title="Traffic · Last 14 Days" meta="SOURCE: Google Analytics 4" />
          <div className="p-5">
            <div className="relative h-56 flex items-end gap-1.5">
              {site.metrics.traffic14d.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm border-t border-cyan transition-all hover:border-amber"
                  style={{
                    height: `${h}%`,
                    background: 'linear-gradient(180deg, #00D9FF, rgba(0,217,255,0.1))',
                    boxShadow: '0 0 10px rgba(0,217,255,0.2)',
                  }}
                />
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Live Feed" meta="REAL-TIME" />
          <div>
            {ACTIVITY_FEED.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${
                  i < ACTIVITY_FEED.length - 1 ? 'border-b border-dashed border-line' : ''
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{
                    background: row.kind === 'alert' ? '#FF3355' : row.kind === 'review' ? '#FFA500' : '#00FF88',
                    boxShadow: `0 0 6px ${row.kind === 'alert' ? '#FF3355' : row.kind === 'review' ? '#FFA500' : '#00FF88'}`,
                  }}
                />
                <div>
                  <div className="text-[13px] text-ink leading-snug">{row.text}</div>
                  <div className="font-mono text-[10px] text-ink-dim mt-1 tracking-wider">{row.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Integrations */}
      <Panel className="mb-7">
        <PanelHead
          title="Integrations · Status"
          meta={`${INTEGRATIONS.filter((i) => i.connected).length} OF ${INTEGRATIONS.length} ACTIVE`}
        />
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {INTEGRATIONS.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3.5 p-4 border border-line rounded-md transition-all hover:border-line-strong hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(180deg, rgba(17,23,58,0.5), rgba(10,14,39,0.6))' }}
            >
              <div
                className={`w-9 h-9 rounded-md grid place-items-center font-mono font-extrabold text-base border ${
                  it.connected ? 'text-amber border-amber/30 bg-amber/[0.10]' : 'text-alert border-alert/30 bg-alert/[0.10]'
                }`}
                style={{
                  boxShadow: it.connected ? '0 0 12px rgba(255,165,0,0.15)' : '0 0 12px rgba(255,51,85,0.15)',
                }}
              >
                {it.icon}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">{it.name}</div>
                <div className={`font-mono text-[10px] mt-0.5 tracking-wider ${it.connected ? 'text-success' : 'text-alert'}`}>
                  {it.connected ? '● CONNECTED' : '○ DISCONNECTED'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Agents + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHead title="Agents · Operating Now" meta={`${AGENTS.filter((a) => a.status === 'live').length} ONLINE`} />
          <div>
            {AGENTS.map((a, i) => (
              <div key={a.id} className={`flex items-center gap-3.5 px-5 py-3.5 ${i < AGENTS.length - 1 ? 'border-b border-dashed border-line' : ''}`}>
                <div
                  className="w-9 h-9 rounded-full grid place-items-center font-mono text-sm font-bold border-2 text-bg-deep"
                  style={{
                    background: a.id === 'claude' ? 'linear-gradient(135deg, #00D9FF, #0099CC)' : 'linear-gradient(135deg, #FFA500, #FFD700)',
                    borderColor: a.id === 'claude' ? '#00D9FF' : '#FFA500',
                    boxShadow: a.id === 'claude' ? '0 0 12px rgba(0,217,255,0.45)' : '0 0 12px rgba(255,165,0,0.45)',
                  }}
                >
                  {a.avatarChar}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink">{a.name}</div>
                  <div className="font-mono text-[11px] text-ink-soft mt-0.5">{a.task}</div>
                </div>
                <div
                  className={`font-mono text-[10px] tracking-[0.14em] uppercase px-2.5 py-1 rounded-full border ${
                    a.status === 'live'
                      ? 'text-success border-success/30 bg-success/[0.06]'
                      : 'text-ink-dim border-line'
                  }`}
                >
                  {a.status === 'live' ? '● ACTIVE' : 'IDLE'}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Today's Tasks" meta={`${TASKS.filter((t) => !t.done).length} OPEN · ${TASKS.filter((t) => t.done).length} DONE`} />
          <div>
            {TASKS.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-3.5 px-5 py-3 ${i < TASKS.length - 1 ? 'border-b border-dashed border-line' : ''}`}>
                <div
                  className={`w-[18px] h-[18px] rounded grid place-items-center font-mono flex-shrink-0 border-[1.5px] ${
                    t.done ? 'bg-cyan border-cyan text-bg-deep' : 'border-cyan text-cyan bg-cyan/[0.05]'
                  }`}
                >
                  {t.done ? '✓' : ''}
                </div>
                <div className={`flex-1 text-[13px] ${t.done ? 'line-through text-ink-dim' : 'text-ink'}`}>{t.text}</div>
                <span
                  className={`font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1 rounded-full border ${
                    t.accent === 'amber'
                      ? 'text-amber border-amber/40 bg-amber/[0.08]'
                      : t.accent === 'cyan'
                      ? 'text-cyan border-cyan/40 bg-cyan/[0.08]'
                      : t.accent === 'gold'
                      ? 'text-gold border-gold/40 bg-gold/[0.08]'
                      : 'text-ink-soft border-line'
                  }`}
                >
                  {t.tag}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
