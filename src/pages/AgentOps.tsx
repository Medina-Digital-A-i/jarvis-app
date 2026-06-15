import { useEffect, useState } from 'react';
import PageHead from '@/components/PageHead';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';
import AgentPanel from '@/components/AgentPanel';

type State = 'working' | 'planning' | 'waiting' | 'idle' | 'error' | 'listening';

interface Agent {
  name: string;
  label: string;
  role: string;
  trigger: string;
  schedule: string;
  icon: string;
  state: State;
  detail: string;
  lastRun: number | null;
  lastStatus: string | null;
  nextDue: number | null;
}
interface Snapshot {
  now: number;
  agents: Agent[];
  summary: { working: number; waiting: number; errors: number; pagesToday: number };
}

const CLS: Record<State, string> = {
  working: 's-work', planning: 's-plan', listening: 's-listen',
  waiting: 's-wait', idle: 's-idle', error: 's-err',
};
const PILL: Record<State, { label: string; cls: string }> = {
  working: { label: 'WORKING', cls: 'text-blue border-blue/40 bg-blue/10' },
  planning: { label: 'PLANNING', cls: 'text-amber border-amber/40 bg-amber/10' },
  listening: { label: 'LISTENING', cls: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10' },
  waiting: { label: 'WAITING', cls: 'text-ink-soft border-line-strong bg-white/5' },
  idle: { label: 'IDLE', cls: 'text-ink-dim border-white/10 bg-white/5' },
  error: { label: 'NEEDS YOU', cls: 'text-red-400 border-red-400/40 bg-red-400/10' },
};

function ago(ts: number | null, now: number): string {
  if (!ts) return 'no runs yet';
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `ran ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `ran ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `ran ${h}h ${m % 60}m ago`;
  return `ran ${Math.floor(h / 24)}d ago`;
}
function until(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((ts - now) / 1000));
  const d = Math.floor(s / 86400);
  if (d >= 1) return `next in ${d}d ${Math.floor((s % 86400) / 3600)}h`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `next in ${h}h ${String(m).padStart(2, '0')}m`;
  return `next in ${m}m ${String(s % 60).padStart(2, '0')}s`;
}

// One robot character; its pose/animation is driven entirely by `state`.
function Bot({ state }: { state: State }) {
  const acc = 'var(--acc)';
  const eyes =
    state === 'error' ? (
      <>
        <path d="M27 33 l8 8 M35 33 l-8 8" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M49 33 l8 8 M57 33 l-8 8" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : state === 'idle' ? (
      <>
        <rect x="26" y="37" width="12" height="2.6" rx="1.3" fill={acc} />
        <rect x="46" y="37" width="12" height="2.6" rx="1.3" fill={acc} />
      </>
    ) : (
      <>
        <circle className="eye" cx="32" cy="38" r="4.5" fill={acc} />
        <circle className="eye" cx="52" cy="38" r="4.5" fill={acc} />
      </>
    );
  const mouth =
    state === 'error' ? (
      <path d="M34 51 q8 -5 16 0" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
    ) : (
      <rect x="35" y="48" width="14" height="3" rx="1.5" fill={acc} />
    );
  return (
    <div className={`aob ${CLS[state]}`}>
      <div className="aob-wrap">
        <svg viewBox="0 0 84 92" width="80" height="88" aria-hidden>
          {state === 'planning' && (
            <>
              <circle className="aob-think" cx="60" cy="15" r="2.2" fill={acc} />
              <circle className="aob-think" style={{ animationDelay: '0.3s' }} cx="67" cy="10" r="2.6" fill={acc} />
              <circle className="aob-think" style={{ animationDelay: '0.6s' }} cx="75" cy="6" r="3" fill={acc} />
            </>
          )}
          {state === 'listening' && <circle className="aob-ring" cx="42" cy="8" fill="none" stroke={acc} strokeWidth="1.5" />}
          {state === 'idle' && (
            <>
              <text className="aob-z" x="58" y="22" fontSize="13" fill={acc}>z</text>
              <text className="aob-z" style={{ animationDelay: '0.8s' }} x="64" y="14" fontSize="10" fill={acc}>z</text>
            </>
          )}
          <line x1="42" y1="10" x2="42" y2="20" stroke="#30363D" strokeWidth="1.5" />
          <circle className="led" cx="42" cy="8" r="3.5" fill={acc} />
          <rect className="head" x="16" y="20" width="52" height="38" rx="11" />
          {eyes}
          {mouth}
          <rect className="body" x="22" y="60" width="40" height="24" rx="7" />
          {state === 'working' && (
            <>
              <rect className="accent" x="30" y="69" width="24" height="3" rx="1.5" fill={acc} />
              <rect className="accent" x="30" y="75" width="16" height="3" rx="1.5" fill={acc} />
            </>
          )}
          {state === 'waiting' && (
            <>
              <circle cx="42" cy="72" r="7.5" fill="none" stroke={acc} strokeWidth="1.5" />
              <line x1="42" y1="72" x2="42" y2="67" stroke={acc} strokeWidth="1.5" />
              <line x1="42" y1="72" x2="46" y2="74" stroke={acc} strokeWidth="1.5" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-dim">{label}</div>
      <div className={`font-mono text-[30px] font-bold leading-tight tracking-[0.04em] mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

function Card({ a, now, onClick }: { a: Agent; now: number; onClick: () => void }) {
  const p = PILL[a.state];
  return (
    <button onClick={onClick} className="text-left rounded-xl border border-line bg-bg-mid px-4 pt-3 pb-4 flex flex-col items-center text-center gap-2 hover:border-blue/50 hover:bg-blue/[0.04] transition-colors animate-fade-up cursor-pointer">
      <Bot state={a.state} />
      <div className="font-mono text-[12.5px] font-bold text-white tracking-[0.02em] -mt-1">{a.label}</div>
      <span className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border tracking-[0.08em] ${p.cls}`}>{p.label}</span>
      <div className="font-sans text-[11.5px] text-ink-soft leading-snug min-h-[2.6em] px-1">{a.detail}</div>
      <div className="w-full pt-2 border-t border-line/70 flex items-center justify-between font-mono text-[9.5px] text-ink-dim tracking-[0.04em]">
        <span>{ago(a.lastRun, now)}</span>
        <span className="text-ink-soft">{a.nextDue ? until(a.nextDue, now) : a.trigger}</span>
      </div>
    </button>
  );
}

export default function AgentOps() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/agent-status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (alive) { setSnap(d); setLastFetch(Date.now()); } })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    load();
    const id = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = tick;
  const agents = snap?.agents ?? [];
  const s = snap?.summary;
  const site = useActiveSiteConfig();
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Agent | null>(null);
  const reload = () => fetch('/api/agent-status', { cache: 'no-store' }).then((r) => r.json()).then(setSnap).catch(() => {});

  const runNow = async () => {
    if (!site) return;
    let token = getActionToken();
    if (!token) {
      const t = window.prompt('Paste your JARVIS action token to run agents:');
      if (!t) return;
      setActionToken(t); token = t;
    }
    setRunning(true); setRunMsg(null);
    try {
      const r = await fetch(`/api/seo-autopilot?site=${encodeURIComponent(site.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
        body: JSON.stringify({ maxChanges: 10 }),
      });
      const j = await r.json();
      if (r.status === 401) setRunMsg('Action token rejected.');
      else if (j.auditOnly) setRunMsg(j.message);
      else if (j.ok) setRunMsg(`✅ ${site.label}: fixed ${j.totalFixes} issue(s) across ${j.pagesFixed} page(s).`);
      else setRunMsg(j.error || 'Run failed.');
    } catch (e) {
      setRunMsg(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <style>{`
        .aob{--acc:#6E7B91}
        .aob.s-work{--acc:#3B82F6} .aob.s-plan{--acc:#F59E0B} .aob.s-listen{--acc:#22C55E}
        .aob.s-wait{--acc:#9BA9BC} .aob.s-idle{--acc:#6E7B91} .aob.s-err{--acc:#EF4444}
        .aob .head,.aob .body{fill:#1C2230;stroke:#30363D;stroke-width:1.5}
        .aob .eye{transform-box:fill-box;transform-origin:center}
        @keyframes aob-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes aob-bobfast{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes aob-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
        @keyframes aob-led{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes aob-ledfast{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes aob-think{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes aob-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
        @keyframes aob-ring{0%{r:6;opacity:.55}100%{r:20;opacity:0}}
        @keyframes aob-z{0%{opacity:0;transform:translate(0,2px)}40%{opacity:1}100%{opacity:0;transform:translate(5px,-10px)}}
        .aob.s-work .aob-wrap{animation:aob-bobfast 1.3s ease-in-out infinite}
        .aob.s-plan .aob-wrap,.aob.s-listen .aob-wrap,.aob.s-wait .aob-wrap{animation:aob-bob 2.6s ease-in-out infinite}
        .aob.s-err .aob-wrap{animation:aob-shake .4s ease-in-out infinite}
        .aob.s-work .led{animation:aob-ledfast .7s infinite}
        .aob.s-listen .led,.aob.s-wait .led{animation:aob-led 1.8s infinite}
        .aob.s-plan .led{animation:aob-led 1s infinite}
        .aob.s-work .eye,.aob.s-plan .eye,.aob.s-listen .eye,.aob.s-wait .eye{animation:aob-blink 4s infinite}
        .aob-think{animation:aob-think 1.4s infinite}
        .aob-ring{animation:aob-ring 1.8s infinite}
        .aob-z{animation:aob-z 2.6s infinite}
      `}</style>

      <PageHead
        title="Agent Operations"
        meta="Live · what every agent is doing right now"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-led-pulse" />
              {lastFetch ? 'live · 15s refresh' : 'connecting…'}
            </span>
            <button className="btn btn-primary" onClick={runNow} disabled={running}>
              {running ? 'Running…' : `⚡ Run ${site?.label ?? 'now'}`}
            </button>
          </div>
        }
      />
      {runMsg && <div className="mb-4 -mt-2 text-[12.5px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2">{runMsg}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Metric label="Working now" value={s?.working ?? 0} tone={s && s.working > 0 ? 'text-blue' : 'text-ink'} />
            <Metric label="Waiting" value={s?.waiting ?? 0} />
            <Metric label="Pages fixed today" value={s?.pagesToday ?? 0} tone="text-emerald-400" />
            <Metric label="Needs attention" value={s?.errors ?? 0} tone={s && s.errors > 0 ? 'text-red-400' : 'text-ink'} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {agents.map((a) => <Card key={a.name} a={a} now={now} onClick={() => setSelected(a)} />)}
          </div>

          <div className="mt-5 font-mono text-[10px] text-ink-dim tracking-[0.1em] uppercase">
            Tap any agent to command it · auto-refreshing every 15s · {agents.length} agents
          </div>
        </>
      )}

      {selected && (
        <AgentPanel agent={selected as any} site={site} onClose={() => setSelected(null)} onRan={reload} />
      )}
    </>
  );
}
