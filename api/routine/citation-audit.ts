// api/routine/citation-audit.ts
// Routine job #4 — monthly local citation coverage audit.
//
//   GET  ?site=tps&token=<JARVIS_ACTION_TOKEN>&dryRun=true
//   POST { present?: string[], site?, dryRun? }   header: x-jarvis-token
//
// HONEST SCOPE: reliable live directory scraping needs a citations data provider
// (Yext/BrightLocal/etc.), which isn't wired up. So this tracks coverage against a
// canonical directory checklist: `present` marks confirmed listings (persisted and
// carried forward between audits), and everything else is reported as a gap, ranked
// by priority. It never fabricates a "we checked Yelp live" result.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from '../_lib/github.js';
import { resolveSite } from '../_lib/sites.js';
import { appendItem, newId, localPathFor, readQueue, type SiteMgmtItem } from '../_lib/sitemgmt.js';

export const config = { maxDuration: 20 };

// Canonical local-citation directories for a Capital Region service business,
// ordered by SEO weight for local pack ranking.
const DIRECTORIES: Array<{ key: string; name: string; priority: 'high' | 'medium' | 'low'; url: string }> = [
  { key: 'google', name: 'Google Business Profile', priority: 'high', url: 'https://business.google.com' },
  { key: 'bing', name: 'Bing Places', priority: 'high', url: 'https://www.bingplaces.com' },
  { key: 'yelp', name: 'Yelp', priority: 'high', url: 'https://biz.yelp.com' },
  { key: 'bbb', name: 'Better Business Bureau', priority: 'high', url: 'https://www.bbb.org' },
  { key: 'facebook', name: 'Facebook Page', priority: 'high', url: 'https://facebook.com' },
  { key: 'apple', name: 'Apple Business Connect', priority: 'medium', url: 'https://businessconnect.apple.com' },
  { key: 'yellowpages', name: 'YellowPages', priority: 'medium', url: 'https://www.yellowpages.com' },
  { key: 'angi', name: 'Angi (Angie’s List)', priority: 'medium', url: 'https://www.angi.com' },
  { key: 'thumbtack', name: 'Thumbtack', priority: 'medium', url: 'https://www.thumbtack.com' },
  { key: 'nextdoor', name: 'Nextdoor Business', priority: 'medium', url: 'https://business.nextdoor.com' },
  { key: 'yahoo', name: 'Yahoo Local', priority: 'low', url: 'https://smallbusiness.yahoo.com' },
  { key: 'chamber', name: 'Capital Region Chamber of Commerce', priority: 'low', url: 'https://www.capitalregionchamber.com' },
  { key: 'manta', name: 'Manta', priority: 'low', url: 'https://www.manta.com' },
  { key: 'foursquare', name: 'Foursquare', priority: 'low', url: 'https://foursquare.com' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireActionToken(req, res)) return;

  const body = req.method === 'POST' ? readBody(req) : {};
  const dryRun = body.dryRun === true || req.query.dryRun === 'true';
  const site = await resolveSite((body.site as string) || (req.query.site as string));

  // Confirmed-present set: this run's `present` ∪ what the last audit knew.
  const store = await readQueue();
  const prior = store.items.find((it) => it.kind === 'citation' && it.siteId === site.id);
  const priorPresent: string[] = (prior?.meta?.present as string[]) || [];
  const incoming: string[] = Array.isArray(body.present) ? (body.present as string[]) : [];
  const present = new Set<string>([...priorPresent, ...incoming].map((k) => k.toLowerCase()));

  const rows = DIRECTORIES.map((d) => ({ ...d, present: present.has(d.key) }));
  const missing = rows.filter((r) => !r.present);
  const missingHigh = missing.filter((r) => r.priority === 'high');
  const coverage = Math.round(((rows.length - missing.length) / rows.length) * 100);

  const now = new Date().toISOString();
  const md = [
    `# TPS Pro — Local Citation Audit (${now.slice(0, 10)})`,
    ``,
    `Coverage: **${coverage}%** (${rows.length - missing.length}/${rows.length} directories) · ${missingHigh.length} high-priority gaps`,
    ``,
    `## Missing listings — claim these`,
    missing.length
      ? missing
          .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
          .map((r) => `- [${r.priority.toUpperCase()}] **${r.name}** — ${r.url}`)
          .join('\n')
      : '_Full coverage across the tracked directories. 🎉_',
    ``,
    `## Confirmed present`,
    rows.filter((r) => r.present).map((r) => `- ${r.name}`).join('\n') || '_None confirmed yet._',
    ``,
    `> NAP must match exactly everywhere: **${site.brand}** · ${site.phone} · ${site.region}.`,
    `> To confirm a listing, re-run with \`present: ["yelp","bbb",…]\` — confirmations carry forward.`,
  ].join('\n');

  const item: SiteMgmtItem = {
    id: newId('citation'),
    kind: 'citation',
    status: 'report',
    date: now,
    siteId: site.id,
    title: `Citation audit — ${coverage}% coverage`,
    summary: `${coverage}% coverage · ${missing.length} missing (${missingHigh.length} high-priority)`,
    body: md,
    localPath: localPathFor('citation'),
    meta: { coverage, present: [...present], missing: missing.map((m) => m.key) },
  };

  try {
    await appendItem(item, { dryRun });
  } catch (e) {
    return res.status(500).json({ error: `Failed to store audit: ${String(e)}` });
  }

  return res.json({ ok: true, id: item.id, dryRun, coverage, missing: missing.map((m) => ({ key: m.key, name: m.name, priority: m.priority, url: m.url })), markdown: md });
}
