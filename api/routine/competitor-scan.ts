// api/routine/competitor-scan.ts
// Routine job #5 — weekly competitor watch.
//
//   GET  ?site=tps&token=<JARVIS_ACTION_TOKEN>&dryRun=true
//   POST { competitors?: string[], site?, dryRun? }   header: x-jarvis-token
//
// Fetches each competitor homepage (best-effort), extracts a light fingerprint
// (title, word count, price mentions), diffs it against the last stored scan to
// spot changes, and asks Haiku for a short threats/opportunities read. Robust to
// unreachable sites — a fetch failure is reported, never fatal.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from '../_lib/github.js';
import { resolveSite } from '../_lib/sites.js';
import { sendTelegram } from '../_lib/telegram.js';
import { generate, appendItem, newId, localPathFor, readQueue, type SiteMgmtItem } from '../_lib/sitemgmt.js';

export const config = { maxDuration: 60 };

// Default Capital Region commercial-cleaning competitors. Override via body.competitors.
const DEFAULT_COMPETITORS = [
  'https://www.coverallalbany.com',
  'https://www.jandmcleaning.com',
  'https://www.stanleysteemer.com',
  'https://www.servicemaster.com',
];

interface Fingerprint {
  url: string;
  ok: boolean;
  title: string;
  words: number;
  priceMentions: number;
  error?: string;
}

async function fingerprint(url: string): Promise<Fingerprint> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'jarvis-competitor-scan' } });
    clearTimeout(t);
    if (!r.ok) return { url, ok: false, title: '', words: 0, priceMentions: 0, error: `HTTP ${r.status}` };
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const words = text.split(/\s+/).filter(Boolean).length;
    const priceMentions = (text.match(/\$\s?\d/g) || []).length;
    return { url, ok: true, title, words, priceMentions };
  } catch (e) {
    return { url, ok: false, title: '', words: 0, priceMentions: 0, error: String(e).slice(0, 80) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireActionToken(req, res)) return;

  const body = req.method === 'POST' ? readBody(req) : {};
  const dryRun = body.dryRun === true || req.query.dryRun === 'true';
  const site = await resolveSite((body.site as string) || (req.query.site as string));
  const competitors: string[] = Array.isArray(body.competitors) && body.competitors.length
    ? (body.competitors as string[])
    : DEFAULT_COMPETITORS;

  const prints = await Promise.all(competitors.map(fingerprint));

  // Diff vs the last stored scan.
  const store = await readQueue();
  const prior = store.items.find((it) => it.kind === 'competitor' && it.siteId === site.id);
  const priorByUrl = new Map<string, Fingerprint>(((prior?.meta?.prints as Fingerprint[]) || []).map((p) => [p.url, p]));

  const changes: string[] = [];
  for (const p of prints) {
    if (!p.ok) {
      changes.push(`${p.url} — unreachable (${p.error})`);
      continue;
    }
    const was = priorByUrl.get(p.url);
    if (!was) {
      changes.push(`${p.url} — baseline captured (title: “${p.title}”)`);
    } else {
      if (was.title !== p.title) changes.push(`${p.url} — title changed: “${was.title}” → “${p.title}”`);
      if (Math.abs(was.words - p.words) > Math.max(150, was.words * 0.15))
        changes.push(`${p.url} — content size shifted ${was.words}→${p.words} words (likely new/removed content)`);
      if (was.priceMentions !== p.priceMentions)
        changes.push(`${p.url} — price mentions ${was.priceMentions}→${p.priceMentions}`);
    }
  }

  const aiRead = await generate(
    `You are a local-SEO analyst for ${site.brand} (${site.region}). Given competitor homepage changes, give a 2-3 sentence threats/opportunities read for a commercial cleaning business. Be concrete and brief. Plain text only.`,
    changes.length ? `Detected changes:\n${changes.join('\n')}` : 'No notable competitor changes this week.',
    400
  );

  const now = new Date().toISOString();
  const md = [
    `# TPS Pro — Competitor Watch (${now.slice(0, 10)})`,
    ``,
    `Scanned ${prints.length} competitors · ${prints.filter((p) => p.ok).length} reachable`,
    ``,
    `## Changes since last scan`,
    changes.length ? changes.map((c) => `- ${c}`).join('\n') : '_No notable changes detected._',
    ``,
    aiRead ? `## Threats / opportunities\n${aiRead}` : '',
  ].join('\n');

  const item: SiteMgmtItem = {
    id: newId('competitor'),
    kind: 'competitor',
    status: 'report',
    date: now,
    siteId: site.id,
    title: `Competitor watch — ${now.slice(0, 10)}`,
    summary: `${changes.length} change(s) across ${prints.length} competitors`,
    body: md,
    localPath: localPathFor('competitor'),
    meta: { prints, changes, aiRead },
  };

  try {
    await appendItem(item, { dryRun });
  } catch (e) {
    return res.status(500).json({ error: `Failed to store scan: ${String(e)}` });
  }

  if (!dryRun && changes.some((c) => /title changed|content size|price mentions/.test(c))) {
    await sendTelegram(`🏁 *Competitor movement — ${site.label}*\n${changes.slice(0, 5).join('\n')}`, { parseMode: 'Markdown' });
  }

  return res.json({ ok: true, id: item.id, dryRun, competitorsScanned: prints.length, changes, aiRead, markdown: md });
}
