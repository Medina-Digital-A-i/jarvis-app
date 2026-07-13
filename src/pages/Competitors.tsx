import { useState, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface Competitor {
  name: string;
  domain: string;
  url: string;
  notes?: string;
}

interface CompetitorData {
  lastUpdated: string;
  targetKeyword: string;
  competitors: Competitor[];
  ourPosition: number | null;
  note?: string;
}

interface GscRow {
  key: string;
  position: number;
}

export default function Competitors() {
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(true);
  // Our SERP position is pulled LIVE from Google Search Console (matched on the
  // target keyword), not from the static competitor-data.json file.
  const [livePosition, setLivePosition] = useState<number | null>(null);
  const [gscChecked, setGscChecked] = useState(false);
  const site = useActiveSiteConfig();
  const [compUrl, setCompUrl] = useState('');
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tmsg, setTmsg] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);

  const teardown = async () => {
    if (!site || !compUrl.trim()) { setTmsg('Enter a competitor URL.'); return; }
    let token = tok || getActionToken();
    if (!token) { setNeedTok(true); return; }
    setActionToken(token);
    setBusy(true); setTmsg(null); setReport(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token }, body: JSON.stringify({ action: 'competitor', site: site.id, competitorUrl: compUrl.trim() }) });
      const d = await r.json();
      if (r.status === 401) { setNeedTok(true); setTmsg('Action token rejected.'); }
      else if (d.ok && d.report) setReport(d.report);
      else setTmsg(d.error || 'Could not analyze that competitor.');
    } catch (e) { setTmsg(String(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    fetch('/competitor-data.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  // Once we know the target keyword, look up our live position in GSC.
  const targetKeyword = data?.targetKeyword;
  useEffect(() => {
    if (!targetKeyword) return;
    let cancelled = false;
    fetch('/api/gsc-data?type=queries&days=90')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const rows: GscRow[] = j.rows ?? [];
        const target = targetKeyword.toLowerCase().trim();
        const exact = rows.find((r) => r.key.toLowerCase().trim() === target);
        const partial = exact ?? rows.find((r) => r.key.toLowerCase().includes(target));
        setLivePosition(partial ? Math.round(partial.position) : null);
      })
      .catch(() => { if (!cancelled) setLivePosition(null); })
      .finally(() => { if (!cancelled) setGscChecked(true); });
    return () => { cancelled = true; };
  }, [targetKeyword]);

  // Prefer the live GSC position; fall back to the file only if GSC has no row.
  const ourPosition = livePosition ?? data?.ourPosition ?? null;

  return (
    <>
      <PageHead
        title="Competitors"
        meta={`Target: ${data?.targetKeyword ?? '—'}`}
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} placeholder="rival URL, e.g. acme-cleaning.com"
              className="px-3 py-2 rounded-md bg-bg-deep border border-line text-ink text-[13px] w-[230px] max-w-[55vw]" />
            <button className="btn btn-primary" onClick={teardown} disabled={busy}>{busy ? 'Analyzing…' : '🔭 AI teardown'}</button>
          </div>
        }
      />

      {needTok && (
        <div className="mb-4 panel p-3 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); teardown(); }}>Save</button>
        </div>
      )}
      {tmsg && <div className="mb-4 text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{tmsg}</div>}

      {report && (
        <Panel className="mb-6">
          <PanelHead title="🔭 AI competitor teardown" meta={compUrl} />
          <div className="p-4 space-y-3">
            <div className="text-[13px] text-ink-soft">{report.summary}</div>
            {(report.gaps || []).length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim mb-2">Gaps to close</div>
                <div className="space-y-2">
                  {report.gaps.map((g: any, i: number) => (
                    <div key={i} className="rounded-lg border border-line bg-white/[0.02] px-4 py-3">
                      <div className="text-[13px] text-white font-medium">{g.topic}</div>
                      <div className="text-[12px] text-ink-soft mt-0.5">{g.why}</div>
                      {g.suggestedPage && <div className="text-[11px] text-blue mt-1 font-mono">→ build: {g.suggestedPage}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(report.keywordOpportunities || []).length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim mb-1">Keyword openings</div>
                <div className="flex flex-wrap gap-1.5">{report.keywordOpportunities.map((k: string, i: number) => <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded border border-line text-ink-soft">{k}</span>)}</div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Target Keyword</div>
            <div className="text-sm font-semibold text-white">{data.targetKeyword}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Our Position · Live GSC</div>
            <div className={`text-2xl font-bold ${
              ourPosition === null
                ? 'text-white/30'
                : ourPosition <= 3
                ? 'text-emerald-400'
                : ourPosition <= 10
                ? 'text-amber-400'
                : 'text-red-400'
            }`}>
              {ourPosition ?? '—'}
            </div>
            {ourPosition === null && (
              <div className="text-xs text-white/25 mt-1">
                {gscChecked ? 'Keyword not in top 100' : 'Checking GSC…'}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Data As Of</div>
            <div className="text-sm font-semibold text-white/50">{data.lastUpdated}</div>
          </div>
        </div>
      )}

      <Panel className="mb-5">
        <PanelHead
          title="Competitor Rankings"
          meta="Populated by SEO agent · update /public/competitor-data.json"
        />

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            {data.competitors.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-3xl mb-3">🏁</div>
                <p className="text-white/40 text-sm">No competitor data yet. The SEO agent will populate this file.</p>
              </div>
            ) : (
              <div>
                {data.competitors.map((comp, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-4 px-5 py-4 ${
                      i < data.competitors.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm border border-white/10 bg-white/5 text-white/50 flex-shrink-0">
                      {comp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{comp.name}</div>
                      {comp.domain ? (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-white/30 hover:text-white/60 transition font-mono"
                        >
                          {comp.domain}
                        </a>
                      ) : (
                        <span className="text-xs text-white/20 font-mono">domain unconfirmed</span>
                      )}
                      {comp.notes && (
                        <div className="text-xs text-white/40 mt-1 leading-relaxed">{comp.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3 border-t border-white/5 text-xs text-white/25 font-mono">
                  {data.note ?? `Last updated · ${data.lastUpdated}`}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Lead notification panel — phone comes from the active site config, not hardcoded */}
      {site?.phone && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4">
          <div className="text-sm font-semibold text-emerald-400 mb-1.5">
            📱 Website Lead Notifications
          </div>
          <div className="text-sm text-white/50">
            Lead alerts for {site.label} go to{' '}
            <span className="font-mono text-white/70">{site.phone}</span>
          </div>
          <div className="text-xs text-white/25 mt-2">
            Form submissions and contact requests notify this number.
          </div>
        </div>
      )}
    </>
  );
}
