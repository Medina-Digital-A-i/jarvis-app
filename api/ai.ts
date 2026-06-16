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
import { resolveSite } from './_lib/sites.js';
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

  if (!site.githubRepo) {
    return res.status(200).json({ auditOnly: true, message: `${site.label} is a ${site.platform} site (no GitHub repo), so JARVIS can't edit its code. Edit it in your site builder.` });
  }
  const repo = site.githubRepo;

  try {
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
