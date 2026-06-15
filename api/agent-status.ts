// api/agent-status.ts
// Powers the live Agent Operations board. Merges three sources into one
// board-ready snapshot: the static agent registry, the latest agent-log entry
// per agent, and the live Turso heartbeat — then derives each agent's state.
//
//   GET /api/agent-status  ->  { now, agents: [...], summary: {...} }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_lib/github.js';
import { readHeartbeats, STALE_MS } from './_lib/heartbeat.js';

export const config = { maxDuration: 30 };

type Cron = 'daily' | 'weekly';
interface AgentDef {
  name: string;
  label: string;
  role: string;
  trigger: string;
  schedule: string;
  icon: string;
  cron?: Cron;
}

// The agents we surface on the board (allowlist — keeps legacy one-shot log
// entries like jarvis-redesign off the board).
const AGENTS: AgentDef[] = [
  { name: 'jarvis-seo-autopilot', label: 'SEO autopilot', role: 'Audits + fixes on-page SEO on the live site', trigger: 'on-demand', schedule: 'On demand · runs in the daily loop', icon: '🛠️' },
  { name: 'jarvis-daily-seo-audit', label: 'Daily SEO audit', role: 'Audits the site, then triggers the autopilot', trigger: 'scheduled', schedule: 'Every day · 9:00 AM ET', icon: '🔍', cron: 'daily' },
  { name: 'jarvis-weekly-seo-digest', label: 'Weekly digest', role: 'Summarizes ranking movers + quick wins', trigger: 'scheduled', schedule: 'Mondays · 8:00 AM ET', icon: '📈', cron: 'weekly' },
  { name: 'jarvis-seo-action-engine', label: 'Action engine', role: 'Turns Search Console data into an action plan', trigger: 'on-demand', schedule: 'On demand', icon: '🎯' },
  { name: 'jarvis-rank-tracker', label: 'Rank tracker', role: 'Tracks keyword rankings from Search Console', trigger: 'live', schedule: 'Live · Search Console', icon: '📈' },
  { name: 'jarvis-blog-publisher', label: 'Blog publisher', role: 'Writes + publishes blog posts to the site', trigger: 'on-demand', schedule: 'On demand', icon: '✍️' },
  { name: 'jarvis-meta-updater', label: 'Meta updater', role: 'Edits a single page’s title + description', trigger: 'on-demand', schedule: 'On demand', icon: '🏷️' },
  { name: 'jarvis-gbp-poster', label: 'GBP poster', role: 'Posts to your Google Business Profile', trigger: 'on-demand', schedule: 'On demand · queue-backed', icon: '📍' },
  { name: 'jarvis-telegram-bot', label: 'Telegram bot', role: 'Your command line for the agents', trigger: 'event', schedule: 'Always on · replies to commands', icon: '💬' },
];

function nextDailyUtc(now: number, hourUtc: number): number {
  const d = new Date(now);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc, 0, 0, 0));
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}
function nextWeekdayUtc(now: number, weekday: number, hourUtc: number): number {
  const d = new Date(now);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc, 0, 0, 0));
  while (next.getUTCDay() !== weekday || next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const host = req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const base = `${proto}://${host}`;
  const now = Date.now();

  const [log, beats, rank] = await Promise.all([
    fetch(`${base}/agent-log.json`, { headers: { 'cache-control': 'no-cache' } })
      .then((r) => r.json())
      .catch(() => ({ entries: [] })),
    readHeartbeats(),
    // Live Search Console health for the rank tracker.
    fetch(`${base}/api/gsc-data?type=queries&days=28`)
      .then((r) => r.json())
      .then((g) => ({ ok: !g.error && Array.isArray(g.rows), count: g.totalRows ?? (g.rows?.length ?? 0) }))
      .catch(() => ({ ok: false, count: 0 })),
  ]);

  const entries: any[] = Array.isArray(log.entries) ? log.entries : [];
  // entries are newest-first; keep the first (latest) seen per agentName.
  const latest = new Map<string, any>();
  for (const e of entries) if (e && e.agentName && !latest.has(e.agentName)) latest.set(e.agentName, e);
  const beat = new Map(beats.map((b) => [b.agentName, b]));

  const telegramOn = !!process.env.TELEGRAM_BOT_TOKEN;

  const agents = AGENTS.map((a) => {
    const last = latest.get(a.name);
    const hb = beat.get(a.name);
    const lastRun = last?.timestamp ? Date.parse(last.timestamp) : null;
    const lastStatus: string | null = last?.status ?? null;
    const blockers: string[] = Array.isArray(last?.blockers) ? last.blockers : [];

    const running = !!hb && hb.finishedAt == null && now - hb.startedAt < STALE_MS;
    const failedRun = !!hb && hb.finishedAt != null && hb.ok === 0 && now - hb.finishedAt < 5 * 60_000;
    // Only a genuine failure counts as "needs attention" — a blockers list, a
    // hard 'blocked'/'failed' status, or a failed heartbeat. 'warning'/'critical'
    // just mean the audit found SITE issues; the agent itself ran fine.
    const realError = blockers.length > 0 || /^(blocked|failed|error)$/i.test(lastStatus || '') || failedRun;

    let nextDue: number | null = null;
    if (a.cron === 'daily') nextDue = nextDailyUtc(now, 13);
    else if (a.cron === 'weekly') nextDue = nextWeekdayUtc(now, 1, 12); // Mon 8am ET ≈ 12:00 UTC (EDT)

    let state: 'working' | 'planning' | 'waiting' | 'idle' | 'error' | 'listening' = 'idle';
    let detail = last?.actions?.[0] ?? a.role;

    if (a.name === 'jarvis-telegram-bot') {
      state = telegramOn ? 'listening' : 'idle';
      detail = telegramOn ? 'Online · awaiting commands' : 'Not connected — needs bot token';
    } else if (a.name === 'jarvis-rank-tracker') {
      state = rank.ok ? 'listening' : 'error';
      detail = rank.ok ? `Live · tracking ${rank.count} keywords` : 'Search Console not responding';
    } else if (running && hb!.phase === 'planning') {
      state = 'planning';
      detail = 'Planning…';
    } else if (running) {
      state = 'working';
      detail = 'Working…';
    } else if (realError) {
      state = 'error';
      detail = blockers[0] || last?.actions?.[0] || 'Needs attention';
    } else if (a.cron && nextDue != null) {
      const lead = a.cron === 'daily' ? 30 * 60_000 : 2 * 3600_000;
      state = nextDue - now <= lead ? 'waiting' : 'idle';
    }

    return {
      name: a.name,
      label: a.label,
      role: a.role,
      trigger: a.trigger,
      schedule: a.schedule,
      icon: a.icon,
      state,
      detail,
      lastRun,
      lastStatus,
      lastAction: last?.actions?.[0] ?? null,
      pagesAffected: Array.isArray(last?.pagesAffected) ? last.pagesAffected.length : 0,
      blockers,
      nextDue,
      running,
    };
  });

  // Pages updated today (UTC) across all agents.
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const pagesToday = entries
    .filter((e) => e?.timestamp && Date.parse(e.timestamp) >= startOfDay.getTime())
    .reduce((n, e) => n + (Array.isArray(e.pagesAffected) ? e.pagesAffected.length : 0), 0);

  const summary = {
    working: agents.filter((a) => a.state === 'working' || a.state === 'planning').length,
    waiting: agents.filter((a) => a.state === 'waiting').length,
    errors: agents.filter((a) => a.state === 'error').length,
    pagesToday,
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ now, agents, summary });
}
