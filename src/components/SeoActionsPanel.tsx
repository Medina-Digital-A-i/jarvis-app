import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHead } from '@/components/Panel';

interface QuickWin {
  keyword: string;
  position: number;
  impressions: number;
  clicks: number;
  targetSlug: string | null;
  suggestedTitle: string;
  suggestedDescription: string;
  confident: boolean;
}
interface ContentGap {
  keyword: string;
  position: number;
  impressions: number;
  suggestedSlug: string;
}
interface ReviewFlag {
  slug: string;
  reason: string;
}
interface Applied {
  keyword: string;
  slug: string;
  ok: boolean;
  detail: string;
}
interface ActionPlan {
  generatedAt: string;
  window: string;
  dataAvailable: boolean;
  summary: { quickWins: number; contentGaps: number; reviewFlags: number };
  quickWins: QuickWin[];
  contentQueue: ContentGap[];
  reviewFlags: ReviewFlag[];
  applied: Applied[];
}

interface LogEntry {
  timestamp: string;
  agentName: string;
  status: string;
  actions: string[];
  pagesAffected?: string[];
}

// Agents created by the autonomous action engine — used to surface "recent changes".
const ACTION_AGENTS = new Set([
  'jarvis-meta-updater',
  'jarvis-blog-publisher',
  'jarvis-seo-action-engine',
  'jarvis-gbp-poster',
]);

const TOKEN_KEY = 'jarvis_action_token';

export default function SeoActionsPanel() {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<LogEntry[]>([]);
  const [token, setToken] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || '' : ''
  );
  const [showToken, setShowToken] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/seo-actions?days=30');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPlan(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load action plan');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChanges = useCallback(async () => {
    try {
      const res = await fetch('/agent-log.json', { cache: 'no-store' });
      const json = await res.json();
      const entries: LogEntry[] = (json.entries || []).filter((e: LogEntry) =>
        ACTION_AGENTS.has(e.agentName)
      );
      setChanges(entries.slice(0, 6));
    } catch {
      setChanges([]);
    }
  }, []);

  useEffect(() => {
    loadPlan();
    loadChanges();
  }, [loadPlan, loadChanges]);

  const runActions = useCallback(async () => {
    if (!token) {
      setShowToken(true);
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/seo-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
        body: JSON.stringify({ apply: true, max: 3, days: 30 }),
      });
      const json = await res.json();
      if (res.status === 401) throw new Error('Action token rejected. Check JARVIS_ACTION_TOKEN.');
      if (json.error && !json.plan) throw new Error(json.error);
      setPlan(json.plan || json);
      await loadChanges();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }, [token, loadChanges]);

  const saveToken = (v: string) => {
    setToken(v);
    if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, v);
  };

  const fmtTs = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
    } catch {
      return ts;
    }
  };

  return (
    <Panel className="mt-6">
      <PanelHead
        title="🤖 SEO Actions"
        meta={plan ? `${plan.summary.quickWins} quick wins · ${plan.summary.contentGaps} content gaps · ${plan.summary.reviewFlags} review flags` : 'Action engine'}
        right={
          <button className="btn" onClick={runActions} disabled={running || loading}>
            {running ? 'Running…' : '⚡ Run Actions'}
          </button>
        }
      />

      {showToken && (
        <div className="px-5 py-3 border-b border-white/5 bg-amber-500/5">
          <label className="block text-xs text-amber-300/80 mb-1.5">
            Enter your <span className="font-mono">JARVIS_ACTION_TOKEN</span> to authorize live changes (stored locally in this browser only):
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
              placeholder="paste action token…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-amber font-mono"
            />
            <button className="btn" onClick={() => setShowToken(false)} disabled={!token}>Save</button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 border-b border-white/5 text-sm text-red-300 bg-red-500/5">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-10 justify-center text-white/40 text-sm">
          <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          Computing action plan…
        </div>
      )}

      {!loading && plan && !plan.dataAvailable && (
        <div className="px-5 py-10 text-center text-white/40 text-sm">
          No live GSC data yet — the action engine activates once Search Console returns rankings.
        </div>
      )}

      {!loading && plan && plan.dataAvailable && (
        <div className="divide-y divide-white/5">
          {/* Pending quick wins */}
          <div className="px-5 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">⚡ Quick Wins — auto-update meta (pos 8–20)</div>
            {plan.quickWins.length === 0 ? (
              <p className="text-white/30 text-sm">No quick-win keywords right now.</p>
            ) : (
              <div className="space-y-2">
                {plan.quickWins.slice(0, 6).map((w, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="text-white/85">{w.keyword}</span>
                      <div className="text-xs text-white/35 mt-0.5 truncate">
                        → {w.targetSlug ? `${w.targetSlug}.html` : 'no confident page match — manual review'} · “{w.suggestedTitle}”
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-xs px-2 py-0.5 rounded border bg-amber-500/10 border-amber-400/30 text-amber-400">pos {w.position}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${w.confident ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-white/40 border-white/10 bg-white/5'}`}>
                        {w.confident ? 'auto' : 'manual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content queue */}
          <div className="px-5 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">📝 Content Queue — new blog posts (pos &gt; 30)</div>
            {plan.contentQueue.length === 0 ? (
              <p className="text-white/30 text-sm">No content gaps detected.</p>
            ) : (
              <div className="space-y-1.5">
                {plan.contentQueue.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80 min-w-0 truncate">{c.keyword}</span>
                    <span className="font-mono text-xs text-white/35 flex-shrink-0">pos {c.position} · {c.impressions} impr</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review flags */}
          {plan.reviewFlags.length > 0 && (
            <div className="px-5 py-4">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-3">🔍 Review Flags — no impressions in 30d</div>
              <div className="flex flex-wrap gap-2">
                {plan.reviewFlags.slice(0, 12).map((f, i) => (
                  <span key={i} className="font-mono text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5 text-white/45">{f.slug}</span>
                ))}
              </div>
            </div>
          )}

          {/* Just-applied (this run) */}
          {plan.applied && plan.applied.length > 0 && (
            <div className="px-5 py-4 bg-emerald-500/[0.03]">
              <div className="text-xs text-emerald-400/70 uppercase tracking-wider mb-3">✓ Applied this run</div>
              <div className="space-y-1.5">
                {plan.applied.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80 min-w-0 truncate">{a.slug} — {a.keyword}</span>
                    <span className={`font-mono text-xs flex-shrink-0 ${a.ok ? 'text-emerald-400' : 'text-red-400'}`}>{a.ok ? a.detail : 'failed'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent changes from the agent log */}
      <div className="px-5 py-4 border-t border-white/8">
        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">🕑 Recent Changes</div>
        {changes.length === 0 ? (
          <p className="text-white/30 text-sm">No autonomous changes logged yet.</p>
        ) : (
          <div className="space-y-2.5">
            {changes.map((c, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/70 font-medium">{c.agentName}</span>
                  <span className="font-mono text-xs text-white/30">{fmtTs(c.timestamp)}</span>
                </div>
                <div className="text-xs text-white/45 mt-0.5">{c.actions[0]}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
