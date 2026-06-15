import { useEffect, useState } from 'react';
import PageHead from '@/components/PageHead';

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
  lastAction: string | null;
  pagesAffected: number;
  blockers: string[];
  nextDue: number | null;
  running: boolean;
}
interface Snapshot {
  now: number;
  agents: Agent[];
  summary: { working: number; waiting: number; errors: number; pagesToday: number };
}

const STATE_META: Record<State, { label: string; pill: string; dot: string; pulse: boolean }> = {
  working: { label: 'WORKING', pill: 'text-blue border-blue/40 bg-blue/10', dot: 'bg-blue', pulse: true },
  planning: { label: 'PLANNING', pill: 'text-amber border-amber/40 bg-amber/10', dot: 'bg-amber', pulse: true },
  listening: { label: 'LISTENING', pill: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10', dot: 'bg-emerald-400', pulse: true },
  waiting: { label: 'WAITING', pill: 'text-ink-soft border-line-strong bg-white/5', dot: 'bg-ink-soft', pulse: false },
  idle: { label: 'IDLE', pill: 'text-ink-dim border-white/10 bg-white/5', dot: 'bg-ink-dim', pulse: false },
  error: { label: 'NEEDS ATTENTION', pill: 'text-red-400 border-red-400/40 bg-red-400/10', dot: 'bg-red-400', pulse: false },
};

function ago(ts: number | null, now: number): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function until(ts: number | null, now: number): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((ts - now) / 1000));
  const d = Math.floor(s / 86400);
  if (d >= 1) return `in ${d}d ${Math.floor((s % 86400) / 3600)}h`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `in ${h}h ${String(m).padStart(2, '0')}m`;
  return `in ${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-dim">{label}</div>
      <div className={`font-mono text-[30px] font-bold leading-tight tracking-[0.04em] mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

function AgentCard({ a, now }: { a: Agent; now: number }) {
  const m = STATE_META[a.state];
  return (
    <div className="rounded-xl border border-line bg-bg-mid px-4 py-4 hover:border-line-strong transition-colors animate-fade-up flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[18px] leading-none" aria-hidden>{a.icon}</span>
        <span className="font-mono text-[13px] font-bold text-white tracking-[0.02em]">{a.label}</span>
        <span className={`ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border ${m.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${m.pulse ? 'animate-led-pulse' : ''}`} />
          {m.label}
        </span>
      </div>

      <div className="font-sans text-[12.5px] text-ink-soft leading-snug min-h-[2.4em]">{a.detail}</div>

      <div className="mt-auto pt-2 border-t border-line/70 flex items-center justify-between font-mono text-[10px] text-ink-dim tracking-[0.06em]">
        <span>{a.lastRun ? `ran ${ago(a.lastRun, now)}` : 'no runs yet'}</span>
        {a.nextDue ? <span className="text-ink-soft">{until(a.nextDue, now)}</span> : <span className="uppercase">{a.trigger}</span>}
      </div>
    </div>
  );
}

export default function AgentOps() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  // Poll the live status every 15s.
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

  // Tick once a second so relative times + countdowns stay live.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = tick;
  const agents = snap?.agents ?? [];
  const s = snap?.summary;

  return (
    <>
      <PageHead
        title="Agent Operations"
        meta="Live · what every agent is doing right now"
        actions={
          <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-led-pulse" />
            {lastFetch ? `synced ${ago(lastFetch, now)}` : 'connecting…'}
          </span>
        }
      />

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => <AgentCard key={a.name} a={a} now={now} />)}
          </div>

          <div className="mt-5 font-mono text-[10px] text-ink-dim tracking-[0.1em] uppercase">
            Auto-refreshing every 15s · {agents.length} agents
          </div>
        </>
      )}
    </>
  );
}
