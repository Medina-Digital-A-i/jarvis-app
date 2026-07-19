// api/routine/blog-draft.ts
// Routine job #1 — generate a weekly SEO blog draft from a topic seed.
//
//   POST { topic?, site?, dryRun? }
//     header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
//
// Generates title + SEO meta + HTML article body (Haiku 4.5), queues it as
// draft_awaiting_approval in public/site-management.json, and pings Telegram
// with "reply APPROVE to publish". NOTHING is published here — publishing goes
// through /api/routine/blog-publish after Miguel approves.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from '../_lib/github.js';
import { resolveSite } from '../_lib/sites.js';
import { sendTelegram } from '../_lib/telegram.js';
import {
  generate,
  appendItem,
  newId,
  slugify,
  localPathFor,
  type SiteMgmtItem,
} from '../_lib/sitemgmt.js';

export const config = { maxDuration: 60 };

// Topic seeds JARVIS rotates through when a Routine doesn't pass one.
const DEFAULT_TOPICS = [
  'Winter parking lot maintenance for Albany commercial properties',
  'How to choose a commercial cleaning vendor in the Capital Region',
  'Post-construction cleanup checklist for Albany property managers',
  'Why bonded & insured matters when hiring a commercial cleaner',
  'Spring common-area deep cleaning for Capital Region apartment complexes',
];

interface Draft {
  title: string;
  slug: string;
  metaDescription: string;
  targetKeyword: string;
  excerpt: string;
  contentHtml: string;
}

function parseDraft(raw: string): Draft | null {
  const txt = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const d = JSON.parse(txt);
    if (d && d.title && d.contentHtml) return d as Draft;
  } catch {
    /* fall through */
  }
  return null;
}

// Deterministic fallback so the job never hard-fails without an API key.
function fallbackDraft(topic: string): Draft {
  return {
    title: topic,
    slug: slugify(topic),
    metaDescription: `${topic} — practical guidance from TPS Pro LLC, Albany's bonded & insured commercial cleaning and property maintenance team.`.slice(0, 160),
    targetKeyword: topic.toLowerCase(),
    excerpt: `${topic}: what Capital Region property managers need to know.`,
    contentHtml: `<p>${topic} is a recurring concern for property managers across Albany and the Capital Region. This draft is a placeholder — set ANTHROPIC_API_KEY so JARVIS can write the full article.</p>`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireActionToken(req, res)) return;

  const body = readBody(req);
  const dryRun = body.dryRun === true || req.query.dryRun === 'true';
  const site = await resolveSite(body.site as string);
  const topic =
    String(body.topic ?? '').trim() ||
    DEFAULT_TOPICS[new Date().getUTCDate() % DEFAULT_TOPICS.length];

  const system = `You are the content writer for ${site.brand}, a bonded & insured commercial cleaning and property maintenance company serving ${site.region}. Write a genuinely useful, locally-relevant blog post that ranks for the topic and converts property managers into quote requests. Respond ONLY with JSON (no prose, no code fence) with these exact keys:
{"title": "<55-65 char SEO title including the locale where natural>",
 "slug": "<kebab-case, no 'blog-' prefix>",
 "metaDescription": "<120-160 chars, benefit + soft CTA>",
 "targetKeyword": "<primary keyword phrase>",
 "excerpt": "<1 sentence summary for the blog index card>",
 "contentHtml": "<the article body only: <h2>/<h3>/<p>/<ul><li> tags, 500-800 words, no <html>/<head>/<h1>, end with a paragraph nudging a free quote>"}`;

  const raw = await generate(system, `Topic seed: ${topic}`, 2000);
  const draft = (raw && parseDraft(raw)) || fallbackDraft(topic);
  draft.slug = slugify(draft.slug || draft.title);

  const now = new Date().toISOString();
  const localPath = localPathFor('blog', draft.slug);
  const bodyMd = [
    `---`,
    `title: ${draft.title}`,
    `slug: ${draft.slug}`,
    `targetKeyword: ${draft.targetKeyword}`,
    `metaDescription: ${draft.metaDescription}`,
    `status: awaiting_approval`,
    `generated: ${now}`,
    `---`,
    ``,
    `# ${draft.title}`,
    ``,
    `_Meta description:_ ${draft.metaDescription}`,
    ``,
    draft.contentHtml,
  ].join('\n');

  const item: SiteMgmtItem = {
    id: newId('blog'),
    kind: 'blog',
    status: 'draft_awaiting_approval',
    date: now,
    siteId: site.id,
    title: draft.title,
    summary: `Blog draft: “${draft.title}” — awaiting APPROVE`,
    body: bodyMd,
    localPath,
    meta: {
      slug: draft.slug,
      targetKeyword: draft.targetKeyword,
      metaDescription: draft.metaDescription,
      excerpt: draft.excerpt,
      contentHtml: draft.contentHtml,
      aiUsed: !!raw,
    },
  };

  try {
    await appendItem(item, { dryRun });
  } catch (e) {
    return res.status(500).json({ error: `Failed to queue draft: ${String(e)}` });
  }

  if (!dryRun) {
    await sendTelegram(
      `📝 *New blog draft ready — ${site.label}*\n“${draft.title}”\n\nReply *APPROVE* to publish it live, or open Site Management to review.\n\`id: ${item.id}\``,
      { parseMode: 'Markdown' }
    );
  }

  return res.json({
    ok: true,
    id: item.id,
    dryRun,
    title: draft.title,
    slug: draft.slug,
    status: item.status,
    localPath,
    markdown: bodyMd,
    publishWith: { endpoint: '/api/routine/blog-publish', body: { id: item.id } },
  });
}
