import { useState, useRef, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';
import { fmtET } from '@/lib/format';

interface Line { role: 'you' | 'jarvis'; text: string; ts: number }

const HELP = [
  'Commands (same as Telegram, but right here):',
  '  /status        — what every agent is doing',
  '  /audit         — run an SEO audit on the active site',
  '  /fix [n]       — autopilot: fix up to n pages (default 10)',
  '  /rank          — top keywords from Search Console',
  '  /plan          — action plan: quick wins to #1',
  '  /help          — this list',
].join('\n');

export default function Console() {
  const site = useActiveSiteConfig();
  const [lines, setLines] = useState<Line[]>([
    { role: 'jarvis', text: `JARVIS online. Active site: ${'{site}'}. Type /help to see what I can do.`, ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines, busy]);

  const say = (role: Line['role'], text: string) => setLines((l) => [...l, { role, text, ts: Date.now() }]);

  const exec = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    say('you', cmd);
    setInput('');
    if (!site) { say('jarvis', 'No active site selected.'); return; }
    const [verb, arg] = cmd.replace(/^\//, '').split(/\s+/);
    setBusy(true);
    try {
      switch (verb.toLowerCase()) {
        case 'help': say('jarvis', HELP); break;
        case 'status': {
          const d = await fetch('/api/agent-status', { cache: 'no-store' }).then((r) => r.json());
          const rows = (d.agents || []).map((a: any) => `  ${a.state.toUpperCase().padEnd(10)} ${a.label} — ${a.detail}`).join('\n');
          say('jarvis', `📊 Agents:\n${rows}`);
          break;
        }
        case 'audit': {
          const d = await fetch(`/api/seo-audit?url=${encodeURIComponent(site.baseUrl)}`).then((r) => r.json());
          if (d.error) { say('jarvis', `⚠️ ${d.error}`); break; }
          const e = (d.issues || []).filter((i: any) => i.type === 'error').length;
          const w = (d.issues || []).filter((i: any) => i.type === 'warning').length;
          say('jarvis', `🔍 ${site.label}: score ${d.score}/100 · ${e} errors, ${w} warnings.`);
          break;
        }
        case 'fix': {
          let token = tok || getActionToken();
          if (!token) { setNeedTok(true); say('jarvis', '🔑 I need your action token to make changes. Paste it above and run again.'); break; }
          setActionToken(token);
          const n = Math.max(1, Math.min(40, Number(arg) || 10));
          say('jarvis', `⚙️ Running autopilot on ${site.label} (up to ${n} pages)…`);
          const d = await fetch(`/api/seo-autopilot?site=${encodeURIComponent(site.id)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
            body: JSON.stringify({ maxChanges: n }),
          }).then((r) => r.json());
          if (d.auditOnly) say('jarvis', `ℹ️ ${d.message}`);
          else if (d.ok) say('jarvis', `✅ Fixed ${d.totalFixes} issue(s) across ${d.pagesFixed} page(s).`);
          else say('jarvis', `⚠️ ${d.error || 'Run failed.'}`);
          break;
        }
        case 'rank': {
          if (!site.gscProperty) { say('jarvis', `📈 ${site.label} has no Search Console property connected (Settings → add one).`); break; }
          const d = await fetch(`/api/gsc-data?type=queries&days=28&site=${encodeURIComponent(site.gscProperty)}`).then((r) => r.json());
          if (d.error) { say('jarvis', `⚠️ ${d.error}`); break; }
          const top = (d.rows || []).slice(0, 8).map((r: any) => `  #${r.position < 10 ? r.position.toFixed(1) : Math.round(r.position)}  ${r.key} (${r.impressions} impr)`).join('\n');
          say('jarvis', `📈 Top keywords (28d):\n${top || '  none'}`);
          break;
        }
        case 'plan': {
          const d = await fetch('/api/seo-actions?days=30').then((r) => r.json());
          if (d.summary) say('jarvis', `🎯 Action plan: ${d.summary.quickWins} quick wins · ${d.summary.contentGaps} content gaps · ${d.summary.reviewFlags} review flags. Open "Get to #1" for the details.`);
          else say('jarvis', `⚠️ ${d.error || 'No plan available.'}`);
          break;
        }
        default:
          say('jarvis', `Plain-English site edits ("add a winter promo banner") are coming with the AI Editor. For now: ${'\n'}${HELP}`);
      }
    } catch (e) {
      say('jarvis', `⚠️ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const chips = ['/status', '/audit', '/fix', '/rank', '/plan', '/help'];

  return (
    <>
      <PageHead title="JARVIS Console" meta={site ? `commanding ${site.label} · same as Telegram` : 'command line'} />

      {needTok && (
        <div className="mb-3 panel p-3 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN"
            className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); }}>Save</button>
        </div>
      )}

      <div className="panel p-0 overflow-hidden">
        <div className="h-[58vh] min-h-[320px] overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed bg-bg-deep/40">
          {lines.map((l, i) => (
            <div key={i} className="mb-2.5">
              <div className={`text-[9px] uppercase tracking-[0.14em] ${l.role === 'you' ? 'text-blue' : 'text-emerald-400'}`}>
                {l.role === 'you' ? '› you' : '⬢ jarvis'} · {fmtET(l.ts)}
              </div>
              <pre className={`whitespace-pre-wrap break-words mt-0.5 ${l.role === 'you' ? 'text-white' : 'text-ink-soft'}`}>
                {l.text.replace('{site}', site?.label ?? '—')}
              </pre>
            </div>
          ))}
          {busy && <div className="text-ink-dim">…</div>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line p-3">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {chips.map((c) => (
              <button key={c} onClick={() => exec(c)} disabled={busy}
                className="text-[11px] font-mono px-2.5 py-1 rounded-md border border-line text-ink-soft hover:text-blue hover:border-blue/40 transition-colors">
                {c}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); exec(input); }} className="flex gap-2">
            <span className="font-mono text-blue self-center">›</span>
            <input
              value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
              placeholder="type a command, e.g. /fix 5"
              className="flex-1 px-3 py-2 rounded-md bg-bg-deep border border-line text-ink text-[13px] font-mono focus:border-blue/50 outline-none"
            />
            <button type="submit" disabled={busy} className="btn btn-primary">Send</button>
          </form>
        </div>
      </div>
    </>
  );
}
