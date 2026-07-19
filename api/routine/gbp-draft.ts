// api/routine/gbp-draft.ts
// Routine job #2 — draft a Google Business Profile post (offer / event / update).
//
//   POST { kind?: 'offer'|'event'|'update', prompt?, site?, dryRun? }
//     header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
//
// Queues the draft for approval and pings Telegram. Actually POSTING to GBP is a
// separate, human-approved step via /api/gbp-post — which is currently blocked on
// re-authing the GMB OAuth refresh token (noted in the response as a dependency).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from '../_lib/github.js';
import { resolveSite } from '../_lib/sites.js';
import { sendTelegram } from '../_lib/telegram.js';
import { generate, appendItem, newId, localPathFor, type SiteMgmtItem } from '../_lib/sitemgmt.js';

export const config = { maxDuration: 30 };

const KINDS = ['offer', 'event', 'update'] as const;
type GbpKind = (typeof KINDS)[number];

const gmbConfigured = () =>
  !!process.env.GMB_OAUTH_REFRESH_TOKEN && !!process.env.GBP_ACCOUNT_ID && !!process.env.GBP_LOCATION_ID;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireActionToken(req, res)) return;

  const body = readBody(req);
  const dryRun = body.dryRun === true || req.query.dryRun === 'true';
  const site = await resolveSite(body.site as string);
  const gbpKind: GbpKind = KINDS.includes(body.kind as GbpKind) ? (body.kind as GbpKind) : 'update';
  const seed = String(body.prompt ?? '').trim();

  const system = `You write short Google Business Profile posts for ${site.brand}, a commercial cleaning & property maintenance company in ${site.region}. Keep it under 1500 characters, warm and local, one clear call to action. Post type: ${gbpKind}. Respond ONLY with the post text — no headings, no quotes, no markdown.`;
  const aiText = await generate(
    system,
    seed || `Write a ${gbpKind} post for this week that would appeal to Albany-area property managers.`,
    600
  );
  const text =
    aiText ||
    `TPS Pro LLC keeps Capital Region commercial properties spotless — bonded, insured, and local. Book a free walkthrough today. 📞 ${site.phone}`;

  const now = new Date().toISOString();
  const item: SiteMgmtItem = {
    id: newId('gbp'),
    kind: 'gbp',
    status: 'draft_awaiting_approval',
    date: now,
    siteId: site.id,
    title: `GBP ${gbpKind} post`,
    summary: `GBP ${gbpKind} draft — awaiting APPROVE`,
    body: `# GBP ${gbpKind} post — ${now.slice(0, 10)}\n\n${text}\n`,
    localPath: localPathFor('gbp'),
    meta: { gbpKind, text, aiUsed: !!aiText, gmbConfigured: gmbConfigured() },
  };

  try {
    await appendItem(item, { dryRun });
  } catch (e) {
    return res.status(500).json({ error: `Failed to queue GBP draft: ${String(e)}` });
  }

  if (!dryRun) {
    await sendTelegram(`📣 *New GBP ${gbpKind} draft — ${site.label}*\n${text}\n\nReply *APPROVE* to post it.`, {
      parseMode: 'Markdown',
    });
  }

  return res.json({
    ok: true,
    id: item.id,
    dryRun,
    gbpKind,
    text,
    status: item.status,
    localPath: item.localPath,
    dependency: gmbConfigured()
      ? null
      : 'GBP posting is blocked until the GMB OAuth refresh token is re-authed (set GMB_OAUTH_REFRESH_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID). Draft is queued for approval regardless.',
    postWith: { endpoint: '/api/gbp-post', body: { message: text } },
  });
}
