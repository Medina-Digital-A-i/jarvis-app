// api/update-meta.ts
// Autonomously update the <title> and meta description (+ Open Graph variants)
// of a page on the live TPS Pro website, committing the change via the GitHub API.
//
// POST { slug, title?, description? }   header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
// GET  ?slug=office-cleaning            -> read current title/description (no auth, read-only)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SITE_REPO,
  getFile,
  putFile,
  slugToPath,
  escapeHtml,
  cors,
  requireActionToken,
  readBody,
  appendAgentLog,
} from './_lib/github';

function extractTitle(html: string): string | null {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}
function extractDescription(html: string): string | null {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  return m ? m[1].trim() : null;
}

// Replace <title>. Returns unchanged html if no <title> present.
function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}
// Replace meta description + og:description (if present).
function replaceDescription(html: string, desc: string): string {
  const safe = escapeHtml(desc);
  let out = html.replace(
    /(<meta\s+name=["']description["']\s+content=["'])[\s\S]*?(["']\s*\/?>)/i,
    `$1${safe}$2`
  );
  out = out.replace(
    /(<meta\s+property=["']og:description["']\s+content=["'])[\s\S]*?(["']\s*\/?>)/i,
    `$1${safe}$2`
  );
  return out;
}
// Mirror title into og:title (if present).
function replaceOgTitle(html: string, title: string): string {
  return html.replace(
    /(<meta\s+property=["']og:title["']\s+content=["'])[\s\S]*?(["']\s*\/?>)/i,
    `$1${escapeHtml(title)}$2`
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Read-only preview of current tags.
  if (req.method === 'GET') {
    const slug = (req.query.slug as string) || '';
    try {
      const path = slugToPath(slug);
      const file = await getFile(SITE_REPO, path);
      if (!file) return res.status(404).json({ error: `Page not found: ${path}` });
      return res.json({
        slug,
        path,
        title: extractTitle(file.content),
        description: extractDescription(file.content),
      });
    } catch (e: unknown) {
      return res.status(500).json({ error: String(e) });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireActionToken(req, res)) return;

  const body = readBody(req);
  const slug = String(body.slug ?? '');
  const title = body.title != null ? String(body.title) : undefined;
  const description = body.description != null ? String(body.description) : undefined;

  if (!slug && slug !== '') return res.status(400).json({ error: 'slug is required' });
  if (!title && !description)
    return res.status(400).json({ error: 'Provide at least one of: title, description' });

  try {
    const path = slugToPath(slug);
    const file = await getFile(SITE_REPO, path);
    if (!file) return res.status(404).json({ error: `Page not found: ${path}` });

    const before = { title: extractTitle(file.content), description: extractDescription(file.content) };

    let html = file.content;
    if (title) html = replaceOgTitle(replaceTitle(html, title), title);
    if (description) html = replaceDescription(html, description);

    if (html === file.content) {
      return res.status(200).json({
        ok: true,
        changed: false,
        message: 'No change — new values match existing tags or no matching tags found.',
        path,
        before,
      });
    }

    const parts = [title && `title`, description && `description`].filter(Boolean).join(' + ');
    const commit = await putFile(
      SITE_REPO,
      path,
      html,
      `seo(meta): update ${parts} for /${path} [JARVIS]`,
      file.sha
    );

    // Best-effort: log the change to the JARVIS agent feed. Don't fail the
    // request if logging hits a hiccup.
    try {
      await appendAgentLog({
        timestamp: new Date().toISOString(),
        agentName: 'jarvis-meta-updater',
        status: 'success',
        actions: [
          `Updated meta on /${path}`,
          title ? `Title → "${title}"` : '',
          description ? `Description → "${description}"` : '',
          `Commit ${commit.commitSha.slice(0, 7)}`,
        ].filter(Boolean),
        pagesAffected: [path],
        deployed: true,
      });
    } catch {
      /* logging is non-critical */
    }

    return res.json({
      ok: true,
      changed: true,
      path,
      before,
      after: { title: title ?? before.title, description: description ?? before.description },
      commit,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
