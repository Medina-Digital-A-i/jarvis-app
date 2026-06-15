import { useState, useEffect, useCallback } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import SeoActionsPanel from '@/components/SeoActionsPanel';
import { useActiveSiteConfig } from '@/lib/store';

interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  isQuickWin: boolean;
}

interface GscData {
  site: string;
  startDate: string;
  endDate: string;
  rows: GscRow[];
  totalRows: number;
  quickWins: number;
  source?: 'live' | 'timeout' | 'awaiting';
  message?: string;
}

const posBadge = (pos: number) =>
  pos <= 3
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
    : pos <= 10
    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
    : 'bg-red-500/15 border-red-500/40 text-red-400';

const posArrow = (pos: number) => {
  if (pos <= 3) return { arrow: '▲', cls: 'text-emerald-400' };
  if (pos <= 10) return { arrow: '→', cls: 'text-amber-400' };
  return { arrow: '▼', cls: 'text-red-400' };
};

export default function Rankings() {
  const [data, setData] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('90');
  const activeSite = useActiveSiteConfig();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    // No GSC property registered for this site → honest "not connected" state.
    if (activeSite && !activeSite.gscProperty) {
      setError(`No Search Console property connected for ${activeSite.label}. Add one in Settings to see live rankings.`);
      setLoading(false);
      return;
    }
    try {
      const siteParam = activeSite?.gscProperty ? `&site=${encodeURIComponent(activeSite.gscProperty)}` : '';
      const res = await fetch(`/api/gsc-data?type=queries&days=${days}${siteParam}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  }, [days, activeSite]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top20 = (data?.rows ?? []).slice(0, 20);
  const opportunities = (data?.rows ?? []).filter(
    (r) => r.position >= 5 && r.position <= 20 && r.impressions >= 50
  );
  const totalClicks = (data?.rows ?? []).reduce((a, r) => a + r.clicks, 0);
  const totalImpressions = (data?.rows ?? []).reduce((a, r) => a + r.impressions, 0);

  return (
    <>
      <PageHead
        title="Rankings · TPS Pro LLC"
        meta="Google Search Console · keyword performance · opportunities"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-amber"
            >
              <option value="7">Last 7 days</option>
              <option value="28">Last 28 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button className="btn" onClick={fetchData} disabled={loading}>
              {loading ? '…' : '⟳ Refresh'}
            </button>
          </div>
        }
      />

      {/* Awaiting-data banner — shown when GSC access isn't granted yet or timed out */}
      {data && (data.source === 'awaiting' || data.source === 'timeout') && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-300 mb-5 flex items-center justify-between gap-4">
          <span>
            {data.source === 'timeout' ? '⏳ ' : '🔌 '}
            <strong>{data.source === 'timeout' ? 'Connecting' : 'Awaiting Live Data'}</strong>
            {' — '}{data.message ?? 'Google Search Console is not returning data yet.'}
          </span>
          <span className="text-xs text-amber-400/70">No data is fabricated — values show “--” until GSC responds</span>
        </div>
      )}

      {/* KPI row */}
      {!loading && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(() => {
            const hasData = (data.rows?.length ?? 0) > 0;
            return [
              { label: 'Keywords Tracked', value: hasData ? data.totalRows : '--', color: 'text-white' },
              { label: 'Total Clicks', value: hasData ? totalClicks.toLocaleString() : '--', color: 'text-emerald-400' },
              { label: 'Total Impressions', value: hasData ? totalImpressions.toLocaleString() : '--', color: 'text-sky-400' },
              { label: '⚡ Opportunities', value: hasData ? opportunities.length : '--', color: 'text-amber-400' },
            ];
          })().map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">{kpi.label}</div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          Pulling data from Google Search Console…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-300 mb-5">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Top 20 Keywords Table */}
          <Panel className="mb-6">
            <PanelHead
              title="Top 20 Keywords by Impressions"
              meta={`${data.startDate} → ${data.endDate}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.03]">
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Keyword</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Position</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Clicks</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Impressions</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {top20.map((row, i) => {
                    const { arrow, cls } = posArrow(row.position);
                    return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.025] transition">
                        <td className="px-4 py-2.5 text-white/25 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 text-white/85 max-w-xs">
                          <span className="truncate block">{row.key}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`text-xs ${cls}`}>{arrow}</span>
                            <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded border ${posBadge(row.position)}`}>
                              {row.position}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{row.clicks.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sky-400">{row.impressions.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-white/50">{row.ctr}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-5 px-4 py-3 border-t border-white/5 text-xs text-white/30">
              <span><span className="text-emerald-400 font-bold">■</span> Pos 1–3 (Top 3)</span>
              <span><span className="text-amber-400 font-bold">■</span> Pos 4–10 (Page 1)</span>
              <span><span className="text-red-400 font-bold">■</span> Pos 11+ (Page 2+)</span>
            </div>
          </Panel>

          {/* Opportunities Panel */}
          <Panel>
            <PanelHead
              title="⚡ Opportunities — Quick Wins"
              meta={`${opportunities.length} keywords at positions 5–20 with 50+ impressions`}
            />
            {opportunities.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-2xl mb-3">📈</div>
                <p className="text-white/30 text-sm">
                  No quick-win keywords found at this filter level. Try extending to 90 days, or these rankings need more volume first.
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-white/5 text-xs text-white/30">
                  These keywords are within striking distance of page 1. Optimizing on-page content can move them up fast.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/[0.03]">
                        <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Keyword</th>
                        <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Position</th>
                        <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Clicks</th>
                        <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">CTR</th>
                        <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-amber-500/5 transition">
                          <td className="px-4 py-3 text-white/85 max-w-xs">
                            <span className="truncate block">{row.key}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded border ${posBadge(row.position)}`}>
                              {row.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sky-400">{row.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">{row.clicks}</td>
                          <td className="px-4 py-3 text-right font-mono text-white/50">{row.ctr}%</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                              row.position <= 8
                                ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                                : 'text-sky-400 border-sky-400/30 bg-sky-400/10'
                            }`}>
                              {row.position <= 8 ? 'HIGH' : 'MEDIUM'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          {/* Autonomous SEO action engine */}
          <SeoActionsPanel />
        </>
      )}
    </>
  );
}
