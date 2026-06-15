// api/seo-autopilot.ts
// The closed loop: audit each live page, then autonomously FIX the SEO issues it
// can fix — committing the patched HTML straight to the live site repo.
//
// This is what turns the read-only audit into an agent that acts on its own.
// It reads each page from SITE_REPO, detects missing/weak on-page SEO, rewrites
// the HTML in place, and commits once per page (capped per run).
//
//   POST { slugs?: string[], maxChanges?: number, dryRun?: boolean }
//     header: x-jarvis-token: <JARVIS_ACTION_TOKEN>   (required unless dryRun)
//   GET  ?dryRun=true            -> preview the fixes it WOULD make (no auth, no writes)
//
// Fixes applied (safe, deterministic, on-page only):
//   - <title> missing / <30 / >60 chars      -> generate a 50–60 char title
//   - meta description missing / <100 / >160  -> generate a ~150 char description
//   - canonical link missing                  -> inject <link rel="canonical">
//   - viewport meta missing                   -> inject mobile viewport
//   - Open Graph (title/description) missing   -> inject from title/description
//   - twitter:card missing                    -> inject summary_large_image
//   - robots noindex present                  -> flip to index,follow
//   - Schema.org JSON-LD missing              -> inject LocalBusiness block
//
// Deliberately NOT auto-changed (need human/LLM judgement): adding an H1 to a
// page that has none, rewriting body copy for thin content, guessing img alt text.
// Those are surfaced in `skipped` so a human can pick them up.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getFile,
  putFile,
  slugToPath,
  escapeHtml,
  cors,
  requireActionToken,
  readBody,
  appendAgentLog,
} from './_lib/github.js';
import { sendTelegram } from './_lib/telegram.js';
import { markRunning, markDone } from './_lib/heartbeat.js';
import { resolveSite, type SiteConfig } from './_lib/sites.js';

// Give the function room to read ~30 pages and commit fixes (Hobby allows 60s).
export const config = { maxDuration: 60 };

// Per-run business identity, pulled from the active site's config.
interface SiteCtx {
  brand: string;
  brandShort: string;
  baseUrl: string;
  phone: string;
  region: string;
}
function ctxOf(s: SiteConfig): SiteCtx {
  return {
    brand: s.brand || s.label,
    brandShort: s.brandShort || s.label,
    baseUrl: (s.baseUrl || `https://${s.domain}`).replace(/\/$/, ''),
    phone: s.phone || '',
    region: s.region || '',
  };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const humanize = (slug: string) =>
  titleCase(slug.replace(/\.html$/, '').replace(/[-_]+/g, ' ').trim() || 'Home');

// --- tiny HTML helpers (string-level, same spirit as update-meta) ----------
const get = (html: string, rx: RegExp): string | null => {
  const m = html.match(rx);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
};
const has = (html: string, rx: RegExp) => rx.test(html);

// Insert markup just before </head> (indented). No-op if there is no <head>.
function injectInHead(html: string, snippet: string): string {
  if (!/<\/head>/i.test(html)) return html;
  return html.replace(/<\/head>/i, `  ${snippet}\n</head>`);
}

interface Fix {
  field: string;
  detail: string;
}

function buildTitle(topic: string, c: SiteCtx): string {
  let t = `${topic} | ${c.brand}`;
  if (t.length > 60) t = `${topic} | ${c.brandShort}`;
  if (t.length > 60) t = `${topic.slice(0, 57 - c.brandShort.length)}… | ${c.brandShort}`;
  // pad short titles so they clear the 30-char floor
  if (t.length < 30 && c.region) t = `${topic} in ${c.region} | ${c.brandShort}`.slice(0, 60);
  return t;
}
function buildDescription(topic: string, c: SiteCtx): string {
  const where = c.region ? ` in ${c.region}` : '';
  const call = c.phone ? ` Call ${c.phone}.` : '';
  const d = `${topic}${where} — ${c.brand}.${call}`.replace(/\s+/g, ' ').trim();
  if (d.length < 100) return `${topic}${where} from ${c.brand}. Quality service you can count on.${call}`.slice(0, 160);
  return d.length > 160 ? d.slice(0, 157).trimEnd() + '…' : d;
}

// Analyse one page's HTML and return the patched HTML + the fixes/skips.
function fixPage(slug: string, html: string, c: SiteCtx): { html: string; fixes: Fix[]; skipped: Fix[] } {
  const fixes: Fix[] = [];
  const skipped: Fix[] = [];
  let out = html;

  const path = slugToPath(slug);
  const isIndex = path === 'index.html';
  const canonicalUrl = isIndex ? `${c.baseUrl}/` : `${c.baseUrl}/${path}`;

  const h1 = get(out, /<h1[^>]*>([^<]+)<\/h1>/i);
  const topic = h1 || humanize(slug);

  // --- title ---------------------------------------------------------------
  const title = get(out, /<title[^>]*>([^<]*)<\/title>/i);
  if (!title || title.length < 30 || title.length > 60) {
    const next = buildTitle(topic, c);
    if (title == null) {
      out = injectInHead(out, `<title>${escapeHtml(next)}</title>`);
    } else {
      out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(next)}</title>`);
    }
    if (out !== html || title == null) fixes.push({ field: 'title', detail: `→ "${next}"` });
  }

  // --- meta description ----------------------------------------------------
  const descRx = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i;
  const desc = get(out, descRx);
  if (!desc || desc.length < 100 || desc.length > 160) {
    const next = buildDescription(topic, c);
    if (desc == null) {
      out = injectInHead(out, `<meta name="description" content="${escapeHtml(next)}">`);
    } else {
      out = out.replace(
        /(<meta[^>]+name=["']description["'][^>]+content=["'])[\s\S]*?(["'])/i,
        `$1${escapeHtml(next)}$2`
      );
    }
    fixes.push({ field: 'description', detail: `→ "${next.slice(0, 60)}…"` });
  }

  // --- canonical -----------------------------------------------------------
  if (!has(out, /<link[^>]+rel=["']canonical["']/i)) {
    out = injectInHead(out, `<link rel="canonical" href="${canonicalUrl}">`);
    fixes.push({ field: 'canonical', detail: `→ ${canonicalUrl}` });
  }

  // --- viewport ------------------------------------------------------------
  if (!has(out, /<meta[^>]+name=["']viewport["']/i)) {
    out = injectInHead(out, `<meta name="viewport" content="width=device-width, initial-scale=1">`);
    fixes.push({ field: 'viewport', detail: 'mobile viewport added' });
  }

  // --- Open Graph ----------------------------------------------------------
  const finalTitle = get(out, /<title[^>]*>([^<]*)<\/title>/i) || buildTitle(topic, c);
  const finalDesc = get(out, descRx) || buildDescription(topic, c);
  if (!has(out, /<meta[^>]+property=["']og:title["']/i)) {
    out = injectInHead(out, `<meta property="og:title" content="${escapeHtml(finalTitle)}">`);
    fixes.push({ field: 'og:title', detail: 'added' });
  }
  if (!has(out, /<meta[^>]+property=["']og:description["']/i)) {
    out = injectInHead(out, `<meta property="og:description" content="${escapeHtml(finalDesc)}">`);
    fixes.push({ field: 'og:description', detail: 'added' });
  }
  if (!has(out, /<meta[^>]+property=["']og:url["']/i)) {
    out = injectInHead(out, `<meta property="og:url" content="${canonicalUrl}">`);
    fixes.push({ field: 'og:url', detail: 'added' });
  }
  if (!has(out, /<meta[^>]+property=["']og:type["']/i)) {
    out = injectInHead(out, `<meta property="og:type" content="website">`);
    fixes.push({ field: 'og:type', detail: 'added' });
  }

  // --- twitter card --------------------------------------------------------
  if (!has(out, /<meta[^>]+name=["']twitter:card["']/i)) {
    out = injectInHead(out, `<meta name="twitter:card" content="summary_large_image">`);
    fixes.push({ field: 'twitter:card', detail: 'added' });
  }

  // --- robots: flip noindex -> index,follow --------------------------------
  // EXCEPT dedicated ad/PPC landing pages (slug ends in "-lp"), which are
  // intentionally noindex to avoid cannibalizing the main service pages they
  // mirror. Never touch their robots tag.
  const isLandingPage = /-lp$/i.test(slug.replace(/\.html$/i, ''));
  const robots = get(out, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i);
  if (isLandingPage && robots && /noindex/i.test(robots)) {
    skipped.push({ field: 'robots', detail: 'noindex left in place — ad landing page (-lp), kept out of organic index on purpose' });
  } else if (robots && /noindex/i.test(robots)) {
    out = out.replace(
      /(<meta[^>]+name=["']robots["'][^>]+content=["'])[\s\S]*?(["'])/i,
      `$1index, follow$2`
    );
    fixes.push({ field: 'robots', detail: `noindex → index, follow` });
  }

  // --- Schema.org LocalBusiness JSON-LD ------------------------------------
  if (!has(out, /<script[^>]+type=["']application\/ld\+json["']/i)) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: c.brand,
      description: finalDesc,
      url: canonicalUrl,
      ...(c.phone ? { telephone: c.phone } : {}),
      ...(c.region ? { areaServed: c.region } : {}),
    };
    out = injectInHead(
      out,
      `<script type="application/ld+json">${JSON.stringify(ld)}</script>`
    );
    fixes.push({ field: 'schema', detail: 'LocalBusiness JSON-LD added' });
  }

  // --- things we will NOT touch automatically ------------------------------
  if (!h1) skipped.push({ field: 'h1', detail: 'no H1 — needs human/LLM to place it in body copy' });
  const imgNoAlt = (out.match(/<img[^>]*>/gi) || []).filter(
    (t) => !/alt=["'][^"']+["']/i.test(t)
  ).length;
  if (imgNoAlt > 0)
    skipped.push({ field: 'img-alt', detail: `${imgNoAlt} image(s) missing alt — needs real description, not a guess` });

  return { html: out, fixes, skipped };
}

// Discover root-level *.html pages in the given site repo.
async function listSitePages(repo: string): Promise<string[]> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jarvis-seo-autopilot',
      },
    });
    if (!r.ok) return [];
    const files = (await r.json()) as Array<{ name: string; type: string }>;
    return files.filter((f) => f.type === 'file' && f.name.endsWith('.html')).map((f) => f.name);
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = readBody(req);
  const dryRun = body.dryRun === true || req.query.dryRun === 'true';
  const maxChanges = Number(body.maxChanges ?? req.query.maxChanges ?? 5);
  const requestedSlugs = Array.isArray(body.slugs) ? (body.slugs as string[]) : null;

  // Writes are gated; a dry run is safe to leave open for previews.
  if (!dryRun && !requireActionToken(req, res)) return;

  // Resolve which site to operate on (defaults to the first/primary site).
  const siteId = (req.query.site as string) || (body.site as string) || undefined;
  const site = await resolveSite(siteId);
  const c = ctxOf(site);

  // Auto-fixes need a GitHub repo to commit to. Non-github sites are audit-only.
  if (!site.githubRepo) {
    return res.status(200).json({
      ok: true,
      auditOnly: true,
      site: site.id,
      message: `${site.label} is a ${site.platform} site with no GitHub repo, so JARVIS can audit and track it but can't auto-commit fixes. Use SEO Health to see issues and apply them in ${site.platform === 'wix' ? 'Wix' : 'your site editor'}.`,
      results: [],
    });
  }
  const repo = site.githubRepo;

  // Light up the live board: this agent is now working (real runs only).
  if (!dryRun) await markRunning('jarvis-seo-autopilot', 'working');

  try {
    const pages = requestedSlugs && requestedSlugs.length ? requestedSlugs : await listSitePages(repo);
    if (!pages.length) {
      return res.status(200).json({
        ok: true,
        message: `No pages found in ${repo} (check GITHUB_TOKEN / repo).`,
        results: [],
      });
    }

    const results: Array<{
      slug: string;
      path: string;
      fixes: Fix[];
      skipped: Fix[];
      committed: boolean;
      commit?: string;
      error?: string;
    }> = [];
    let committed = 0;

    // Read every page up front, in bounded-concurrency batches. Sequential reads
    // over ~30 pages blow past the function timeout; parallel reads finish in ~2s.
    const CONCURRENCY = 8;
    const files: Array<{ slug: string; path: string; file: Awaited<ReturnType<typeof getFile>>; error?: string }> = [];
    for (let i = 0; i < pages.length; i += CONCURRENCY) {
      const batch = pages.slice(i, i + CONCURRENCY);
      const read = await Promise.all(
        batch.map(async (slug) => {
          const path = slugToPath(slug);
          try {
            return { slug, path, file: await getFile(repo, path) };
          } catch (e: unknown) {
            return { slug, path, file: null, error: String(e) };
          }
        })
      );
      files.push(...read);
    }

    // Apply fixes. Commits stay sequential and stop once we hit the per-run cap.
    for (const { slug, path, file, error } of files) {
      if (error) {
        results.push({ slug, path, fixes: [], skipped: [], committed: false, error });
        continue;
      }
      if (!file) {
        results.push({ slug, path, fixes: [], skipped: [], committed: false, error: 'page not found in repo' });
        continue;
      }
      const { html, fixes, skipped } = fixPage(slug, file.content, c);
      const changed = html !== file.content && fixes.length > 0;

      if (changed && !dryRun && committed >= maxChanges) {
        results.push({ slug, path, fixes, skipped: [...skipped, { field: 'cap', detail: `deferred — hit maxChanges=${maxChanges}, will fix next run` }], committed: false });
        continue;
      }

      if (changed && !dryRun) {
        try {
          const summary = fixes.map((f) => f.field).join(', ');
          const commit = await putFile(
            repo,
            path,
            html,
            `seo(autopilot): fix ${summary} on /${path} [JARVIS]`,
            file.sha
          );
          committed++;
          results.push({ slug, path, fixes, skipped, committed: true, commit: commit.commitSha.slice(0, 7) });
        } catch (e: unknown) {
          results.push({ slug, path, fixes, skipped, committed: false, error: String(e) });
        }
      } else {
        results.push({ slug, path, fixes, skipped, committed: false });
      }
    }

    const totalFixes = results.reduce((n, r) => n + (r.committed ? r.fixes.length : 0), 0);
    const pagesAffected = results.filter((r) => r.committed).map((r) => r.path);

    // Log the run to the agent feed (skip on dry runs — nothing happened).
    if (!dryRun && pagesAffected.length) {
      try {
        await appendAgentLog({
          timestamp: new Date().toISOString(),
          agentName: 'jarvis-seo-autopilot',
          status: 'success',
          actions: [
            `Autopilot run: fixed ${totalFixes} issue(s) across ${pagesAffected.length} page(s)`,
            ...results
              .filter((r) => r.committed)
              .map((r) => `/${r.path}: ${r.fixes.map((f) => f.field).join(', ')} (commit ${r.commit})`),
          ],
          pagesAffected,
          deployed: true,
        });
      } catch {
        /* logging is non-critical */
      }

      // Ping the owner on Telegram with a summary (no-op if the bot isn't set up).
      const top = results
        .filter((r) => r.committed)
        .slice(0, 8)
        .map((r) => `• /${r.path}: ${r.fixes.map((f) => f.field).join(', ')}`)
        .join('\n');
      const more = pagesAffected.length > 8 ? `\n…and ${pagesAffected.length - 8} more` : '';
      await sendTelegram(
        `🤖 *Autopilot ran — ${site.label}*\nFixed *${totalFixes}* issue(s) across *${pagesAffected.length}* page(s):\n${top}${more}`,
        { parseMode: 'Markdown' }
      );
    }

    if (!dryRun) await markDone('jarvis-seo-autopilot', true);
    return res.json({
      ok: true,
      dryRun,
      maxChanges,
      pagesScanned: results.length,
      pagesFixed: pagesAffected.length,
      totalFixes,
      results,
    });
  } catch (e: unknown) {
    if (!dryRun) await markDone('jarvis-seo-autopilot', false);
    return res.status(500).json({ error: String(e) });
  }
}
