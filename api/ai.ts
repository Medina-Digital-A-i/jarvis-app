// api/ai.ts
// The AI superpower: Claude reads a page of the live site, applies a plain-English
// change, and (on confirm) commits it. Powers the in-app AI Editor.
//
//   POST { action: 'pages',  site }                         → list editable pages
//   POST { action: 'edit',   site, path, instruction }      → preview an edit (no write)
//   POST { action: 'commit', site, path, content, summary } → commit the edited HTML
// All gated by x-jarvis-token. github-hosted sites only (need a repo to commit to).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { cors, requireActionToken, readBody, getFile, putFile, slugToPath, appendAgentLog } from './_lib/github.js';
import { resolveSite, type SiteConfig } from './_lib/sites.js';
import { sendTelegram } from './_lib/telegram.js';

export const config = { maxDuration: 60 };

const MODEL = process.env.JARVIS_AI_MODEL || 'claude-sonnet-4-6';

async function listPages(repo: string): Promise<string[]> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'jarvis-ai' },
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireActionToken(req, res)) return;

  const body = readBody(req);
  const action = String(body.action ?? 'edit');
  const site = await resolveSite(body.site as string);

  const claude = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const host = req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const selfBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${proto}://${host}`;

  try {
    // ---- AI actions that work for ANY site (no repo needed) ----------------
    if (action === 'ads') return await adsRecommend(site, selfBase, claude(), res);
    if (action === 'competitor') return await competitorReport(site, selfBase, body, claude(), res);
    if (action === 'gbp') return await gbpDrafts(site, body, claude(), res);

    // ---- actions that mutate the site repo (github-hosted only) ------------
    if (!site.githubRepo) {
      return res.status(200).json({ auditOnly: true, message: `${site.label} is a ${site.platform} site (no GitHub repo), so JARVIS can't edit its code. Edit it in your site builder.` });
    }
    const repo = site.githubRepo;
    if (action === 'pages') {
      const pages = await listPages(repo);
      return res.json({ pages });
    }

    if (action === 'commit') {
      const path = slugToPath(String(body.path ?? ''));
      const content = String(body.content ?? '');
      const summary = String(body.summary ?? 'AI edit');
      if (!content) return res.status(400).json({ error: 'content is required' });
      const file = await getFile(repo, path);
      const commit = await putFile(repo, path, content, `ai-edit: ${summary} [JARVIS]`, file?.sha);
      try {
        await appendAgentLog({
          timestamp: new Date().toISOString(),
          agentName: 'jarvis-ai-editor',
          status: 'success',
          actions: [`AI edit on /${path} (${site.label})`, summary, `Commit ${commit.commitSha.slice(0, 7)}`],
          pagesAffected: [path],
          deployed: true,
        });
      } catch { /* non-critical */ }
      await sendTelegram(`✏️ *AI edit shipped — ${site.label}*\n/${path}: ${summary}`, { parseMode: 'Markdown' });
      return res.json({ ok: true, path, commit });
    }

    // action === 'edit' — produce a preview (no write)
    const path = slugToPath(String(body.path ?? 'index.html'));
    const instruction = String(body.instruction ?? '').trim();
    if (!instruction) return res.status(400).json({ error: 'instruction is required' });
    const file = await getFile(repo, path);
    if (!file) return res.status(404).json({ error: `Page not found: ${path}` });
    const original = file.content;

    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Find-and-replace edits keep Claude's OUTPUT tiny (fast, no truncation on big
    // pages). Each "find" must be an exact substring we apply server-side.
    const sys = `You edit one HTML page for ${site.brand} (${site.domain}${site.region ? ', ' + site.region : ''}). The user describes a change. Respond with ONLY a JSON object, no prose, no code fences:
{"summary":"<one short sentence>","feasible":true,"edits":[{"find":"<EXACT substring copied verbatim from the page>","replace":"<replacement>"}]}
Rules:
- Each "find" MUST appear character-for-character in the page HTML below. Keep it short but unique (include nearby tags if needed for uniqueness).
- To INSERT, set "find" to an existing anchor (e.g. an opening tag) and "replace" to that same anchor plus your new HTML.
- Make ONLY the requested change; match the page's existing visual style for anything new.
- If it's not doable on this page, return "feasible":false with an empty edits array.`;
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: sys,
      messages: [{ role: 'user', content: `Change to make: ${instruction}\n\n--- PAGE HTML (/${path}) ---\n${original}` }],
    });
    let txt = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed: { summary?: string; feasible?: boolean; edits?: Array<{ find: string; replace: string }> };
    try { parsed = JSON.parse(txt); } catch { return res.status(200).json({ ok: false, error: 'Could not parse the edit. Try rephrasing the instruction.' }); }
    if (parsed.feasible === false || !Array.isArray(parsed.edits) || parsed.edits.length === 0) {
      return res.status(200).json({ ok: false, error: parsed.summary || "That change isn't doable on this page — try another page or be more specific." });
    }

    let newHtml = original;
    const applied: string[] = [];
    const failed: string[] = [];
    for (const e of parsed.edits) {
      if (typeof e.find !== 'string' || !e.find) continue;
      const idx = newHtml.indexOf(e.find);
      if (idx === -1) { failed.push(e.find.slice(0, 40)); continue; }
      newHtml = newHtml.slice(0, idx) + (e.replace ?? '') + newHtml.slice(idx + e.find.length);
      applied.push(e.find.slice(0, 40));
    }
    if (applied.length === 0) {
      return res.status(200).json({ ok: false, error: 'The proposed edit did not match the live page. Try rephrasing.' });
    }
    return res.json({
      ok: true, changed: newHtml !== original, path,
      summary: parsed.summary || instruction, newHtml,
      before: original.length, after: newHtml.length,
      appliedCount: applied.length, failedCount: failed.length,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}

function parseJson(txt: string): any {
  const t = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(t); } catch { return null; }
}

// ---- GBP agent: write ready-to-publish Google Business Profile posts --------
async function gbpDrafts(site: SiteConfig, body: Record<string, unknown>, client: Anthropic, res: VercelResponse) {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  const theme = String(body.theme ?? '').trim();
  const sys = `You write Google Business Profile posts for ${site.brand}, a local business in ${site.region || 'its area'}. GBP posts are short (about 150-300 characters), warm, specific, and end with a clear call to action. Respond with ONLY JSON:
{"posts":[{"type":"<offer|update|tip|event>","text":"<the post, 150-300 chars>","cta":"<LEARN_MORE|CALL|BOOK|ORDER>","imageIdea":"<one line describing a photo to attach>"}]}
Write 3 varied posts (e.g. a promotion, a helpful tip, a service-area/seasonal update). Local, human, no hashtags spam.`;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 1500, system: sys,
    messages: [{ role: 'user', content: theme ? `Focus theme: ${theme}` : `General weekly posts for ${site.brand} (${site.domain}).` }],
  });
  const out = parseJson(msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''));
  if (!out?.posts) return res.status(200).json({ ok: false, error: 'Could not generate posts — try again.' });
  return res.json({ ok: true, site: site.id, posts: out.posts });
}

// ---- Ads agent: recommend a launch-ready paid-search campaign --------------
async function adsRecommend(site: SiteConfig, base: string, client: Anthropic, res: VercelResponse) {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  let rows: any[] = [];
  if (site.gscProperty) {
    rows = await fetch(`${base}/api/gsc-data?type=queries&days=90&site=${encodeURIComponent(site.gscProperty)}`)
      .then((r) => r.json()).then((d) => d.rows || []).catch(() => []);
  }
  const kw = rows.slice(0, 40).map((r) => `${r.key} (pos ${Math.round(r.position)}, ${r.impressions} impr)`).join('\n');
  const sys = `You are a Google Ads strategist for ${site.brand}, a local business in ${site.region || 'its area'} (${site.domain}). Design ONE launch-ready Search campaign. Use the real Search Console queries provided to pick commercial-intent keywords. Respond with ONLY JSON:
{"campaignName":"","dailyBudget":<number USD>,"monthlyEstimate":<number USD>,"location":"","adGroups":[{"name":"","keywords":["keyword (match type)"],"headlines":["<=30 chars"],"descriptions":["<=90 chars"]}],"rationale":"<2 sentences: who we target and why>","projectedClicks":"<rough range/mo>"}
Rules: 2-3 ad groups; 5-8 keywords each (phrase/exact for intent); 3 headlines + 2 descriptions per group; budget realistic for a local SMB ($10-40/day). No prose outside the JSON.`;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 2500, system: sys,
    messages: [{ role: 'user', content: rows.length ? `Top Search Console queries:\n${kw}` : `No Search Console data yet — base the campaign on the business: ${site.brand}, ${site.region}.` }],
  });
  const campaign = parseJson(msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''));
  if (!campaign) return res.status(200).json({ ok: false, error: 'Could not generate a campaign — try again.' });
  return res.json({ ok: true, site: site.id, campaign, basedOnQueries: rows.length });
}

// ---- Competitor agent: gap report vs a rival -------------------------------
async function competitorReport(site: SiteConfig, base: string, body: Record<string, unknown>, client: Anthropic, res: VercelResponse) {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  const competitorUrl = String(body.competitorUrl ?? '').trim();
  if (!competitorUrl) return res.status(400).json({ error: 'competitorUrl is required' });
  let compText = '';
  try {
    const html = await fetch(competitorUrl.startsWith('http') ? competitorUrl : `https://${competitorUrl}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JARVIS/1.0)' }, signal: AbortSignal.timeout(12000),
    }).then((r) => r.text());
    compText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
  } catch {
    return res.status(200).json({ ok: false, error: `Couldn't fetch ${competitorUrl}.` });
  }
  let rows: any[] = [];
  if (site.gscProperty) rows = await fetch(`${base}/api/gsc-data?type=queries&days=90&site=${encodeURIComponent(site.gscProperty)}`).then((r) => r.json()).then((d) => d.rows || []).catch(() => []);
  const myKw = rows.slice(0, 30).map((r) => r.key).join(', ');
  const sys = `You are a local-SEO competitive analyst for ${site.brand} (${site.domain}, ${site.region || ''}). Compare us to the competitor's homepage text and our Search Console keywords. Respond ONLY as JSON:
{"summary":"<2 sentences>","gaps":[{"topic":"","why":"","suggestedPage":"<slug or title to create>"}],"keywordOpportunities":["keyword we should target"],"quickActions":["<1-line action>"]}
Find services/topics/keywords the competitor emphasizes that we are weak on or missing. Be specific and local.`;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 2000, system: sys,
    messages: [{ role: 'user', content: `OUR keywords: ${myKw || '(none yet)'}\n\nCOMPETITOR (${competitorUrl}) homepage text:\n${compText}` }],
  });
  const report = parseJson(msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''));
  if (!report) return res.status(200).json({ ok: false, error: 'Could not analyze — try again.' });
  return res.json({ ok: true, site: site.id, competitor: competitorUrl, report });
}
