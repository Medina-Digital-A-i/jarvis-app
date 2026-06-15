// api/seo-actions.ts
// Turns Google Search Console ranking data into a concrete SEO action plan, and
// (optionally) auto-applies the safe "quick win" meta updates.
//
// GET/POST ?days=30                       -> returns the action plan (read-only)
// POST { apply: true, max?: 3 }           -> also auto-applies quick-win meta updates
//   header: x-jarvis-token: <JARVIS_ACTION_TOKEN>   (required only when apply=true)
//
// Action rules:
//   - position 8–20 & impressions > 10  -> "quick win"   -> meta update
//   - position > 30                     -> "content gap" -> queue a blog post
//   - known page with no impressions    -> "review flag"
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, readBody, ghToken, SITE_REPO, appendAgentLog } from './_lib/github.js';

interface Row {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const STOP = new Set(['the', 'a', 'in', 'of', 'for', 'and', 'to', 'near', 'me', 'ny', 'best', 'top']);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function baseUrl(req: VercelRequest): string {
  const host = req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return `${proto}://${host}`;
}

// List root-level *.html slugs in the live site repo (dynamic — no hardcoded page list).
async function listSitePages(): Promise<string[]> {
  try {
    const r = await fetch(`https://api.github.com/repos/${SITE_REPO}/contents/`, {
      headers: { Authorization: `Bearer ${ghToken()}`, Accept: 'application/vnd.github+json', 'User-Agent': 'jarvis-seo-engine' },
    });
    if (!r.ok) return [];
    const files = (await r.json()) as Array<{ name: string; type: string }>;
    return files.filter((f) => f.type === 'file' && f.name.endsWith('.html')).map((f) => f.name.replace(/\.html$/, ''));
  } catch {
    return [];
  }
}

// Best-effort: match a keyword to the most relevant page slug (>=2 shared tokens).
function matchPage(keyword: string, pages: string[]): string | null {
  const kt = new Set(tokens(keyword));
  let best: { slug: string; score: number } | null = null;
  for (const slug of pages) {
    const st = tokens(slug);
    const score = st.filter((t) => kt.has(t)).length;
    if (score >= 2 && (!best || score > best.score)) best = { slug, score };
  }
  return best?.slug ?? null;
}

function suggestTitle(keyword: string): string {
  const base = `${titleCase(keyword)} | TPS Pro LLC`;
  return base.length <= 62 ? base : `${titleCase(keyword)} | TPS Pro`;
}
function suggestDescription(keyword: string): string {
  return `Professional ${keyword.toLowerCase()} in Albany & the Capital Region. TPS Pro LLC — bonded & insured. Free quote: (518) 948-7156.`.slice(0, 158);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = readBody(req);
  const days = String((req.query.days as string) || body.days || '30');
  const apply = body.apply === true || req.query.apply === 'true';
  const max = Number(body.max ?? req.query.max ?? 3);

  try {
    // 1) Gather ranking rows (queries) — from body if supplied, else live GSC.
    let rows: Row[] = Array.isArray(body.rows) ? (body.rows as Row[]) : [];
    let pageRows: Row[] = [];
    if (rows.length === 0) {
      const base = baseUrl(req);
      const [q, p] = await Promise.all([
        fetch(`${base}/api/gsc-data?type=queries&days=${days}`).then((r) => r.json()).catch(() => ({ rows: [] })),
        fetch(`${base}/api/gsc-data?type=pages&days=${days}`).then((r) => r.json()).catch(() => ({ rows: [] })),
      ]);
      rows = q.rows || [];
      pageRows = p.rows || [];
    }

    const pages = await listSitePages();

    // 2) Classify.
    const quickWins = rows
      .filter((r) => r.position >= 8 && r.position <= 20 && r.impressions > 10)
      .sort((a, b) => b.impressions - a.impressions)
      .map((r) => {
        const slug = matchPage(r.key, pages);
        return {
          keyword: r.key,
          position: r.position,
          impressions: r.impressions,
          clicks: r.clicks,
          targetSlug: slug,
          suggestedTitle: suggestTitle(r.key),
          suggestedDescription: suggestDescription(r.key),
          confident: !!slug,
        };
      });

    const contentQueue = rows
      .filter((r) => r.position > 30 && r.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .map((r) => ({
        keyword: r.key,
        position: r.position,
        impressions: r.impressions,
        suggestedSlug: `blog-${tokens(r.key).join('-')}`,
        reason: 'Ranks beyond page 3 — needs dedicated content to compete.',
      }));

    // 3) Known pages with no impressions in the window.
    const seen = new Set((pageRows || []).map((r) => (r.key || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '') || 'index'));
    const reviewFlags = pages
      .filter((slug) => slug !== 'index' && !seen.has(`${slug}.html`) && !seen.has(slug))
      .map((slug) => ({ slug: `${slug}.html`, reason: `No impressions in the last ${days} days — review content/links or consider noindex.` }));

    const plan = {
      generatedAt: new Date().toISOString(),
      window: `${days}d`,
      dataAvailable: rows.length > 0,
      summary: {
        quickWins: quickWins.length,
        contentGaps: contentQueue.length,
        reviewFlags: reviewFlags.length,
      },
      quickWins,
      contentQueue,
      reviewFlags,
      applied: [] as Array<{ keyword: string; slug: string; ok: boolean; detail: string }>,
    };

    // 4) Optionally auto-apply confident quick wins.
    if (apply) {
      const token = process.env.JARVIS_ACTION_TOKEN;
      const sent = (req.headers['x-jarvis-token'] as string) || (req.query.token as string) || '';
      if (!token || sent !== token) {
        return res.status(401).json({ error: 'Unauthorized — apply=true requires a valid x-jarvis-token.', plan });
      }
      const base = baseUrl(req);
      const candidates = quickWins.filter((w) => w.confident).slice(0, max);
      for (const w of candidates) {
        try {
          const r = await fetch(`${base}/api/update-meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
            body: JSON.stringify({ slug: w.targetSlug, title: w.suggestedTitle, description: w.suggestedDescription }),
          });
          const j = await r.json();
          plan.applied.push({ keyword: w.keyword, slug: w.targetSlug!, ok: !!j.ok, detail: j.changed ? `commit ${j.commit?.commitSha?.slice(0, 7)}` : j.message || j.error || 'no change' });
        } catch (e: unknown) {
          plan.applied.push({ keyword: w.keyword, slug: w.targetSlug!, ok: false, detail: String(e) });
        }
      }
      try {
        await appendAgentLog({
          timestamp: plan.generatedAt,
          agentName: 'jarvis-seo-action-engine',
          status: 'success',
          actions: [
            `Ran action engine (${days}d): ${quickWins.length} quick wins, ${contentQueue.length} content gaps, ${reviewFlags.length} review flags`,
            ...plan.applied.map((a) => `${a.ok ? 'Applied' : 'Failed'} meta on ${a.slug} for "${a.keyword}" — ${a.detail}`),
          ],
          pagesAffected: plan.applied.filter((a) => a.ok).map((a) => a.slug),
          deployed: plan.applied.some((a) => a.ok),
        });
      } catch {
        /* non-critical */
      }
    }

    return res.json(plan);
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
