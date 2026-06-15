import { useEffect, useState } from 'react';
import { type SiteConfig, getActionToken, setActionToken } from '@/lib/store';
import { fmtET } from '@/lib/format';

interface Agent {
  name: string;
  label: string;
  role: string;
  schedule: string;
  state: string;
  detail: string;
  lastRun: number | null;
}
interface LogEntry { timestamp: string; agentName: string; status: string; actions: string[] }

// An on-demand action a bot can perform right now.
interface BotAction {
  label: string;
  needsToken?: boolean;
  run: (site: SiteConfig, token: string) => Promise<string>;
}

async function jsonFetch(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// Per-agent command sets. Each returns a human-readable result string.
function actionsFor(name: string): BotAction[] {
  switch (name) {
    case 'jarvis-seo-autopilot':
      return [
        {
          label: '⚡ Run fixes now', needsToken: true,
          run: async (site, token) => {
            const { status, body } = await jsonFetch(`/api/seo-autopilot?site=${encodeURIComponent(site.id)}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
              body: JSON.stringify({ maxChanges: 10 }),
            });
            if (status === 401) return 'Action token rejected.';
            if (body.auditOnly) return body.message;
            return body.ok ? `✅ Fixed ${body.totalFixes} issue(s) across ${body.pagesFixed} page(s).` : (body.error || 'Run failed.');
          },
        },
        {
          label: '👀 Preview (no changes)',
          run: async (site) => {
            const { body } = await jsonFetch(`/api/seo-autopilot?site=${encodeURIComponent(site.id)}&dryRun=true`);
            if (body.auditOnly) return body.message;
            const wouldFix = (body.results || []).filter((r: any) => r.fixes?.length).length;
            return `Would fix ${wouldFix} page(s) (${body.pagesScanned} scanned). Hit "Run fixes now" to apply.`;
          },
        },
      ];
    case 'jarvis-daily-seo-audit':
      return [{
        label: '🔍 Run audit now',
        run: async (site) => {
          const { body } = await jsonFetch(`/api/seo-audit?url=${encodeURIComponent(site.baseUrl)}`);
          if (body.error) return body.error;
          const errs = (body.issues || []).filter((i: any) => i.type === 'error').length;
          const warns = (body.issues || []).filter((i: any) => i.type === 'warning').length;
          return `Score ${body.score}/100 · ${errs} errors, ${warns} warnings.`;
        },
      }];
    case 'jarvis-rank-tracker':
      return [{
        label: '📈 Refresh rankings',
        run: async (site) => {
          if (!site.gscProperty) return `${site.label} has no Search Console property connected (Settings).`;
          const { body } = await jsonFetch(`/api/gsc-data?type=queries&days=28&site=${encodeURIComponent(site.gscProperty)}`);
          return body.error ? body.error : `Tracking ${body.totalRows ?? (body.rows?.length ?? 0)} keywords (last 28d).`;
        },
      }];
    case 'jarvis-seo-action-engine':
      return [
        {
          label: '🎯 Build action plan',
          run: async () => {
            const { body } = await jsonFetch(`/api/seo-actions?days=30`);
            return body.summary ? `${body.summary.quickWins} quick wins · ${body.summary.contentGaps} content gaps · ${body.summary.reviewFlags} review flags.` : (body.error || 'No plan.');
          },
        },
        {
          label: '⚡ Apply quick wins', needsToken: true,
          run: async (_site, token) => {
            const { status, body } = await jsonFetch(`/api/seo-actions`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
              body: JSON.stringify({ apply: true, max: 3 }),
            });
            if (status === 401) return 'Action token rejected.';
            const applied = (body.applied || []).filter((a: any) => a.ok).length;
            return `Applied ${applied} quick-win meta update(s).`;
          },
        },
      ];
    case 'jarvis-telegram-bot':
      return [{
        label: '💬 Open @Jarvis_183bot',
        run: async () => { window.open('https://t.me/Jarvis_183bot', '_blank'); return 'Opened Telegram. Use /status /audit /fix to command the agents from your phone.'; },
      }];
    default:
      return [];
  }
}

export default function AgentPanel({ agent, site, onClose, onRan }: { agent: Agent; site: SiteConfig | null; onClose: () => void; onRan: () => void }) {
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);
  const actions = actionsFor(agent.name);

  useEffect(() => {
    fetch('/agent-log.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setHistory((d.entries || []).filter((e: LogEntry) => e.agentName === agent.name).slice(0, 6)))
      .catch(() => {});
  }, [agent.name]);

  const doAction = async (a: BotAction) => {
    if (!site) return;
    let token = tok || getActionToken();
    if (a.needsToken && !token) { setNeedTok(true); return; }
    if (token) setActionToken(token);
    setBusy(a.label); setResult(null);
    try { setResult(await a.run(site, token)); onRan(); }
    catch (e) { setResult(String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto panel p-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-line flex items-center gap-3">
          <span className="text-[22px]">{(agent as any).icon ?? '🤖'}</span>
          <div className="min-w-0">
            <div className="font-mono text-[14px] text-white font-bold">{agent.label}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">{agent.state} · {site?.label}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-ink-dim hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-[13px] text-ink-soft leading-snug">{agent.role}</div>
          <div className="flex gap-3 text-[11px] font-mono text-ink-dim">
            <span>🕒 {agent.schedule}</span>
            <span>· last run {agent.lastRun ? fmtET(agent.lastRun) : 'never'}</span>
          </div>

          {/* commands */}
          {actions.length > 0 ? (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue mb-2">Tell it to do something</div>
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button key={a.label} className="btn btn-primary" disabled={busy !== null} onClick={() => doAction(a)}>
                    {busy === a.label ? '…' : a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-ink-dim">
              {agent.name === 'jarvis-blog-publisher' && 'Publishes posts to the site. Open Blog Manager to queue a topic.'}
              {agent.name === 'jarvis-meta-updater' && 'Runs automatically via the Action Engine when applying quick wins.'}
              {agent.name === 'jarvis-gbp-poster' && 'Posts to Google Business Profile — needs GBP credentials connected first.'}
            </div>
          )}

          {needTok && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN"
                className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
              <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); }}>Save token</button>
            </div>
          )}
          {result && <div className="text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{result}</div>}

          {/* recent activity */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim mb-2">Recent activity</div>
            <div className="space-y-1.5">
              {history.length === 0 && <div className="text-[12px] text-ink-dim">No runs logged yet.</div>}
              {history.map((e, i) => (
                <div key={i} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-ink-dim">
                    <span className={`w-1.5 h-1.5 rounded-full ${/^success/.test(e.status) ? 'bg-emerald-400' : e.status === 'blocked' ? 'bg-red-400' : 'bg-amber'}`} />
                    {fmtET(e.timestamp)}
                  </div>
                  <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">{e.actions?.[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
