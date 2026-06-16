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

    const sys = `You are an expert web developer making one precise edit to a single HTML page for ${site.brand} (${site.domain}, ${site.region}). Apply ONLY the change the user asks for. Preserve every other byte of markup, styling, scripts, and content exactly as-is. Keep the document valid. Match the page's existing visual style for anything you add. Return ONLY the complete edited HTML document — no markdown code fences, no explanation.`;
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: sys,
      messages: [{ role: 'user', content: `Change to make: ${instruction}\n\n--- CURRENT HTML of /${path} ---\n${original}` }],
    });
    let newHtml = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    newHtml = newHtml.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Guard against a truncated/garbled response.
    if (newHtml.length < original.length * 0.5 || !/<\/html>/i.test(newHtml.slice(-2000)) && /<\/html>/i.test(original)) {
      return res.status(200).json({ ok: false, error: 'The edit came back incomplete (page may be too large). Try a more specific instruction.' });
    }
    const changed = newHtml !== original;
    return res.json({ ok: true, changed, path, summary: instruction, newHtml, before: original.length, after: newHtml.length });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
