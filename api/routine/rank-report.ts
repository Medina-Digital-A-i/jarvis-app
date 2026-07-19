// api/routine/rank-report.ts
// Routine job #3 — weekly rank tracking + report from Google Search Console.
//
//   GET ?site=tps&token=<JARVIS_ACTION_TOKEN>&dryRun=true
//
// Pulls current GSC query data (via /api/gsc-data), diffs it against the most
// recent stored rank report to find movers (±3 positions), flags CTR-optimization
// targets (high impressions, low CTR), writes a markdown report to the queue, and
// returns the structured data. Read-only against the live site — never publishes.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken } from '../_lib/github.js';
import { resolveSite } from '../_lib/sites.js';
import {
  appendItem,
  newId,
  localPathFor,
  readQueue,
  type SiteMgmtItem,
} from '../_lib/sitemgmt.js';

export const config = { maxDuration: 30 };

interface Row {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number; // percent
  position: number;
}

async function fetchGsc(base: string, gscProperty: string): Promise<{ rows: Row[]; source: string }> {
  try {
    const url = `${base}/api/gsc-data?type=queries&days=7&site=${encodeURIComponent(gscProperty)}`;
    const r = await fetch(url);
    if (!r.ok) return { rows: [], source: 'error' };
    const j = (await r.json()) as { rows?: Row[]; source?: string };
    return { rows: j.rows || [], source: j.source || 'unknown' };
  } catch {
    return { rows: [], source: 'error' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireActionToken(req, res)) return;

  const dryRun = req.query.dryRun === 'true';
  const site = await resolveSite(req.query.site as string);
  if (!site.gscProperty) {
    return res.status(200).json({ ok: false, message: `${site.label} has no linked Search Console property.` });
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${proto}://${req.headers.host}`;
  const { rows, source } = await fetchGsc(base, site.gscProperty);

  // Prior snapshot = most recent stored rank report for this site.
  const store = await readQueue();
  const prior = store.items.find((it) => it.kind === 'rank' && it.siteId === site.id);
  const priorRows: Row[] = ((prior?.meta?.rows as Row[]) || []);
  const priorByKey = new Map(priorRows.map((r) => [r.key, r]));

  const movers = rows
    .map((r) => {
      const p = priorByKey.get(r.key);
      if (!p) return null;
      const delta = Math.round((p.position - r.position) * 10) / 10; // + = moved up
      return Math.abs(delta) >= 3 ? { key: r.key, from: p.position, to: r.position, delta } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.delta) - Math.abs(a!.delta)) as Array<{ key: string; from: number; to: number; delta: number }>;

  // CTR targets: real impressions, on-page-1/2, but under-clicked.
  const ctrTargets = rows
    .filter((r) => r.impressions >= 50 && r.position <= 20 && r.ctr < 2)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  const now = new Date().toISOString();
  const md = [
    `# TPS Pro — Weekly Rank Report (${now.slice(0, 10)})`,
    ``,
    `Source: ${source} · Property: ${site.gscProperty} · Keywords tracked: ${rows.length}`,
    ``,
    `## Movers (±3 positions vs last report)`,
    movers.length
      ? movers.map((m) => `- **${m.key}**: ${m.from} → ${m.to} (${m.delta > 0 ? '▲ +' : '▼ '}${m.delta})`).join('\n')
      : prior
      ? '_No keywords moved 3+ spots this week._'
      : '_First report — no prior week to compare. Movers appear next run._',
    ``,
    `## CTR optimization targets (high impressions, low CTR)`,
    ctrTargets.length
      ? ctrTargets.map((r) => `- **${r.key}** — pos ${r.position}, ${r.impressions} impr, ${r.ctr}% CTR → rewrite title/meta`).join('\n')
      : '_None flagged — CTR looks healthy or GSC data is still warming up._',
  ].join('\n');

  const item: SiteMgmtItem = {
    id: newId('rank'),
    kind: 'rank',
    status: 'report',
    date: now,
    siteId: site.id,
    title: `Weekly rank report — ${now.slice(0, 10)}`,
    summary: `${movers.length} movers · ${ctrTargets.length} CTR targets · ${rows.length} keywords`,
    body: md,
    localPath: localPathFor('rank'),
    meta: { source, rows, movers, ctrTargets },
  };

  try {
    await appendItem(item, { dryRun });
  } catch (e) {
    return res.status(500).json({ error: `Failed to store report: ${String(e)}` });
  }

  return res.json({ ok: true, id: item.id, dryRun, source, movers, ctrTargets, keywordsTracked: rows.length, markdown: md });
}
