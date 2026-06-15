import { useState, useEffect, useCallback } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface Row { key: string; clicks: number; impressions: number; ctr: number; position: number }
interface Issue { type: 'error' | 'warning' | 'ok'; label: string; detail: string }

export default function GetToOne() {
  const site = useActiveSiteConfig();
  const [rows, setRows] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [noGsc, setNoGsc] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [needTok, setNeedTok] = useState(false);
  const [tok, setTok] = useState(getActionToken());

  const analyze = useCallback(async () => {
    if (!site) return;
    setLoading(true); setRunMsg(null); setNoGsc(false);
    // On-page audit (works for any site)
    const auditP = fetch(`/api/seo-audit?url=${encodeURIComponent(site.baseUrl)}`).then((r) => r.json()).catch(() => null);
    // Rankings (only if a GSC property is connected)
    const gscP = site.gscProperty
      ? fetch(`/api/gsc-data?type=queries&days=90&site=${encodeURIComponent(site.gscProperty)}`).then((r) => r.json()).catch(() => null)
      : Promise.resolve(null);
    const [audit, gsc] = await Promise.all([auditP, gscP]);
    setIssues(audit?.issues ?? []);
    if (!site.gscProperty) setNoGsc(true);
    setRows(Array.isArray(gsc?.rows) ? gsc.rows : []);
    setLoading(false);
  }, [site]);

  useEffect(() => { analyze(); }, [analyze]);

  const runAutopilot = async () => {
    if (!site) return;
    const token = tok || getActionToken();
    if (!token) { setNeedTok(true); return; }
    setActionToken(token);
    setRunning(true); setRunMsg(null);
    try {
      const r = await fetch(`/api/seo-autopilot?site=${encodeURIComponent(site.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
        body: JSON.stringify({ maxChanges: 10 }),
      });
      const j = await r.json();
      if (r.status === 401) { setRunMsg('Action token rejected.'); setNeedTok(true); }
      else if (j.auditOnly) setRunMsg(j.message);
      else if (j.ok) { setRunMsg(`✅ Fixed ${j.totalFixes} issue(s) across ${j.pagesFixed} page(s).`); analyze(); }
      else setRunMsg(j.error || 'Run failed.');
    } catch (e) {
      setRunMsg(String(e));
    } finally {
      setRunning(false);
    }
  };

  // --- derive recommendations from live data --------------------------------
  const byImp = [...rows].sort((a, b) => b.impressions - a.impressions);
  const atTop = byImp.filter((r) => r.position <= 3);
  const quickWins = byImp.filter((r) => r.position > 3 && r.position <= 15 && r.impressions >= 3).slice(0, 8);
  const climbing = byImp.filter((r) => r.position > 15 && r.position <= 40 && r.impressions >= 2).slice(0, 6);
  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');
  const canAutoFix = site?.platform === 'github';

  const pos = (n: number) => `#${n < 10 ? n.toFixed(1) : Math.round(n)}`;

  return (
    <>
      <PageHead
        title="Get to #1"
        meta={site ? `${site.label} · what to do to rank first` : 'rank first'}
        actions={
          <div className="flex gap-2">
            <button className="btn" onClick={analyze} disabled={loading || running}>{loading ? '…' : '⟳ Re-analyze'}</button>
            <button className="btn btn-primary" onClick={runAutopilot} disabled={running || loading}>
              {running ? 'Running…' : canAutoFix ? '⚡ Fix it now' : '⚡ Run audit'}
            </button>
          </div>
        }
      />

      {needTok && (
        <div className="mb-4 panel p-4 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token needed to run agents</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN"
            className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[180px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); runAutopilot(); }}>Save & run</button>
        </div>
      )}
      {runMsg && <div className="mb-4 text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{runMsg}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Already top 3" value={atTop.length} tone="text-emerald-400" />
            <Stat label="Quick wins to #1" value={quickWins.length} tone="text-blue" />
            <Stat label="On-page issues" value={errors.length + warnings.length} tone={errors.length ? 'text-red-400' : 'text-amber'} />
            <Stat label="Keywords tracked" value={rows.length} />
          </div>

          {/* 1. fastest path to #1 */}
          <Panel className="mb-5">
            <PanelHead title="🏆 Fastest path to #1" meta="ranked by traffic upside" />
            <div className="p-4 space-y-2">
              {noGsc && <Empty text={`Connect a Search Console property for ${site?.label} (Settings) to see ranking opportunities.`} />}
              {!noGsc && quickWins.length === 0 && <Empty text="No page-1-adjacent keywords right now. Build content (below) to create new ranking chances." />}
              {quickWins.map((r) => (
                <Rec key={r.key}
                  title={`"${r.key}"`}
                  badge={pos(r.position)}
                  body={`${r.impressions.toLocaleString()} impressions/90d · you're on page ${Math.ceil(r.position / 10)}. Small on-page gains push this onto page 1.`}
                />
              ))}
            </div>
          </Panel>

          {/* 2. technical fixes (run on demand) */}
          <Panel className="mb-5">
            <PanelHead title="🛠️ On-page fixes" meta={canAutoFix ? 'auto-fixable' : 'manual (no repo)'} right={
              <button className="btn btn-primary text-[11px] py-1" onClick={runAutopilot} disabled={running}>
                {running ? '…' : canAutoFix ? 'Fix now' : 'Re-audit'}
              </button>
            } />
            <div className="p-4 space-y-2">
              {errors.length + warnings.length === 0 && <Empty text="No technical issues on the homepage. 🎉" />}
              {errors.slice(0, 6).map((i, n) => <Rec key={'e' + n} title={i.label} body={i.detail} badge="ERROR" tone="red" />)}
              {warnings.slice(0, 6).map((i, n) => <Rec key={'w' + n} title={i.label} body={i.detail} badge="WARN" tone="amber" />)}
              {!canAutoFix && (errors.length + warnings.length > 0) && (
                <p className="text-[12px] text-ink-dim px-1">This is a {site?.platform} site — apply these in your editor; JARVIS can't auto-commit without a GitHub repo.</p>
              )}
            </div>
          </Panel>

          {/* 3. content to create */}
          {climbing.length > 0 && (
            <Panel className="mb-5">
              <PanelHead title="✍️ Content to create" meta="ranking on page 2-4 — needs depth" />
              <div className="p-4 space-y-2">
                {climbing.map((r) => (
                  <Rec key={r.key} title={`"${r.key}"`} badge={pos(r.position)}
                    body={`${r.impressions.toLocaleString()} impressions but stuck on page ${Math.ceil(r.position / 10)}. A dedicated page/post can win this.`} />
                ))}
              </div>
            </Panel>
          )}

          {/* 4. reviews */}
          <Panel className="mb-5">
            <PanelHead title="⭐ Reviews → local #1" />
            <div className="p-4 space-y-2">
              <Rec title="Get more 5-star Google reviews" tone="amber"
                body="Review count + rating is one of the biggest local-pack ranking factors. Ask every happy customer; reply to every review." />
              <Empty text="Live review tracking needs your Google Business Profile connected (GMB credentials). Not connected yet — say the word and I'll wire it up." />
            </div>
          </Panel>

          {/* 5. defend */}
          {atTop.length > 0 && (
            <Panel>
              <PanelHead title="✅ Defend your #1s" meta={`${atTop.length} keyword${atTop.length === 1 ? '' : 's'} in top 3`} />
              <div className="p-4 flex flex-wrap gap-2">
                {atTop.slice(0, 20).map((r) => (
                  <span key={r.key} className="text-[12px] font-mono px-2.5 py-1 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                    {pos(r.position)} {r.key}
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-dim">{label}</div>
      <div className={`font-mono text-[28px] font-bold leading-tight mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

function Rec({ title, body, badge, tone }: { title: string; body: string; badge?: string; tone?: 'red' | 'amber' | 'blue' }) {
  const badgeCls = tone === 'red' ? 'text-red-400 border-red-400/30 bg-red-400/10'
    : tone === 'amber' ? 'text-amber border-amber/30 bg-amber/10'
    : 'text-blue border-blue/30 bg-blue/10';
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] px-4 py-3 flex gap-3 items-start">
      {badge && <span className={`shrink-0 mt-0.5 text-[10px] font-mono px-2 py-0.5 rounded border ${badgeCls}`}>{badge}</span>}
      <div className="min-w-0">
        <div className="text-[13.5px] text-white font-medium leading-snug">{title}</div>
        <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">{body}</div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-[12.5px] text-ink-dim px-1 py-1">{text}</div>;
}
