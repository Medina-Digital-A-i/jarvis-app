// api/routine/blog-publish.ts
// The approval gate — the ONLY path that pushes a blog draft to the live site.
//
//   POST { id }                         → publish a queued draft by id
//   POST { id, dryRun: true }           → validate + build payload, publish nothing
//     header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
//
// Flow: Miguel replies APPROVE → Phoebe/the Routine reads the reply and calls this
// endpoint with the draft id. This checks the killswitch, looks up the queued draft,
// and forwards it to /api/publish-blog (which commits blog-<slug>.html to the site
// repo and triggers the GitHub Pages redeploy), then marks the draft published.
//
// KILLSWITCH: set JARVIS_AUTO_PUBLISH_ENABLED=false to refuse ALL publishing here,
// no matter what — the draft stays queued.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from '../_lib/github.js';
import { sendTelegram } from '../_lib/telegram.js';
import { autoPublishEnabled, getItem, updateItem, buildPublishPayload } from '../_lib/sitemgmt.js';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireActionToken(req, res)) return;

  // Killswitch — fail closed BEFORE any lookup or write.
  if (!autoPublishEnabled()) {
    return res.status(403).json({
      ok: false,
      blocked: true,
      reason: 'Auto-publish is disabled (JARVIS_AUTO_PUBLISH_ENABLED=false). Draft left queued.',
    });
  }

  const body = readBody(req);
  const dryRun = body.dryRun === true;
  const id = String(body.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'id is required (the queued draft id from /api/routine/blog-draft)' });

  const item = await getItem(id);
  if (!item) return res.status(404).json({ error: `No queued item with id ${id}` });
  if (item.kind !== 'blog') return res.status(400).json({ error: `Item ${id} is a ${item.kind}, not a blog draft` });
  if (item.status === 'published') return res.status(409).json({ error: `Draft ${id} is already published` });

  const payload = buildPublishPayload(item);
  if (!payload) return res.status(422).json({ error: `Draft ${id} is missing fields required to publish` });

  if (dryRun) {
    return res.json({ ok: true, dryRun: true, wouldPublish: { slug: payload.slug, title: payload.title } });
  }

  // Forward to the battle-tested publisher (reuses its page template + card injection).
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${proto}://${req.headers.host}`;
  const token = process.env.JARVIS_ACTION_TOKEN || '';

  let publishResult: Record<string, unknown>;
  try {
    const r = await fetch(`${base}/api/publish-blog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
      body: JSON.stringify(payload),
    });
    publishResult = (await r.json()) as Record<string, unknown>;
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: 'publish-blog rejected the draft', detail: publishResult });
    }
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Failed to reach /api/publish-blog: ${String(e)}` });
  }

  await updateItem(id, {
    status: 'published',
    summary: `Published: “${item.title}”`,
    meta: { ...(item.meta || {}), publishResult, publishedAt: new Date().toISOString() },
  });

  await sendTelegram(`✅ *Blog published — ${item.title}*\n${String(publishResult.url || '')}`, { parseMode: 'Markdown' });

  return res.json({ ok: true, id, published: true, result: publishResult });
}
