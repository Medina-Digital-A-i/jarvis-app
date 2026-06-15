import { useState, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

interface AgentLogEntry {
  timestamp: string;
  agentName: string;
  status: string;
  actions: string[];
  pagesAffected: string[];
  deployed: boolean;
  blockers?: string[];
}

interface AgentLog {
  lastUpdated: string;
  entries: AgentLogEntry[];
}

const statusBadge = (status: string) => {
  if (status === 'success' || status === 'success_queued')
    return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
  if (status === 'blocked')
    return 'text-red-400 border-red-400/30 bg-red-400/10';
  return 'text-white/40 border-white/10 bg-white/5';
};

const statusLabel = (status: string) => {
  if (status === 'success_queued') return 'QUEUED';
  return status.toUpperCase();
};

const dotColor = (status: string) => {
  if (status === 'success' || status === 'success_queued') return '#34d399';
  if (status === 'blocked') return '#f87171';
  return '#94a3b8';
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }) + ' ET';
  } catch {
    return ts;
  }
}

export default function AgentActivity() {
  const [log, setLog] = useState<AgentLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/agent-log.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLog(d))
      .catch(() => setLog({ lastUpdated: '', entries: [] }))
      .finally(() => setLoading(false));
  }, []);

  const entries = log?.entries ?? [];
  const totalRuns = entries.length;
  const successRuns = entries.filter((e) => e.status.startsWith('success')).length;
  const blockedRuns = entries.filter((e) => e.status === 'blocked').length;

  return (
    <>
      <PageHead
        title="Agent Activity"
        meta="SEO agent run history · actions · blockers"
      />

      {/* Stats */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Total Runs</div>
            <div className="text-2xl font-bold text-white">{totalRuns}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Successful</div>
            <div className="text-2xl font-bold text-emerald-400">{successRuns}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Blocked</div>
            <div className="text-2xl font-bold text-red-400">{blockedRuns}</div>
          </div>
        </div>
      )}

      <Panel>
        <PanelHead
          title="Agent Activity Feed"
          meta={log?.lastUpdated ? `Log updated: ${log.lastUpdated}` : 'Loading…'}
        />

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            Loading agent log…
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              No agent activity yet — SEO agents will log here once they run.
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            {entries.map((entry, i) => (
              <div
                key={i}
                className={`border-b border-white/5 ${i === entries.length - 1 ? 'border-b-0' : ''}`}
              >
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition"
                >
                  <div
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dotColor(entry.status), boxShadow: `0 0 6px ${dotColor(entry.status)}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{entry.agentName}</span>
                      <span className="font-mono text-xs text-white/30">{formatTs(entry.timestamp)}</span>
                    </div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">{entry.actions[0]}</div>
                    {entry.pagesAffected && entry.pagesAffected.length > 0 && (
                      <div className="text-xs text-white/25 mt-0.5">
                        Pages: {entry.pagesAffected.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${statusBadge(entry.status)}`}>
                      {statusLabel(entry.status)}
                    </span>
                    <span className="text-white/20 text-xs">{expanded === i ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === i && (
                  <div className="px-11 pb-4 space-y-3">
                    {/* All actions */}
                    <div>
                      <div className="text-xs text-white/30 uppercase tracking-wider mb-2">Actions Taken</div>
                      <ul className="space-y-1">
                        {entry.actions.map((action, ai) => (
                          <li key={ai} className="text-xs text-white/60 flex gap-2">
                            <span className="text-white/20 flex-shrink-0">→</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Blockers */}
                    {entry.blockers && entry.blockers.length > 0 && (
                      <div>
                        <div className="text-xs text-red-400/70 uppercase tracking-wider mb-2">Blockers</div>
                        <ul className="space-y-1">
                          {entry.blockers.map((b, bi) => (
                            <li key={bi} className="text-xs text-red-400/60 flex gap-2">
                              <span className="text-red-400/40 flex-shrink-0">⚠</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Deployed */}
                    <div className="text-xs text-white/30 font-mono">
                      Deployed to production: <span className={entry.deployed ? 'text-emerald-400' : 'text-red-400/60'}>{entry.deployed ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Unblock action card */}
      {!loading && blockedRuns > 0 && (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <div className="text-sm font-semibold text-red-400 mb-1">🔒 Action Required to Unblock Agents</div>
          <div className="text-xs text-white/50 leading-relaxed">
            Grant <span className="font-mono text-white/70">jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com</span> access
            in Google Search Console → Settings → Users and permissions → Add user as <strong className="text-white/60">Full</strong>.
            This is a one-time action that unblocks all rank-tracking agents.
          </div>
        </div>
      )}
    </>
  );
}
