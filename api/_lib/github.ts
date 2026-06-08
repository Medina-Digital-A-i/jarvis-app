// api/_lib/github.ts
// Shared GitHub Contents API helpers used by the autonomous SEO action endpoints.
// Files under api/_lib/ start with "_" so Vercel does NOT turn them into routes.
//
// Auth: every mutating endpoint reads its GitHub token from process.env.GITHUB_TOKEN.
// NEVER hardcode a token here — it would be committed to the repo and leak.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API = 'https://api.github.com';

// Repo that hosts the live TPS Pro website (flat HTML, GitHub Pages / Netlify).
export const SITE_REPO = process.env.GITHUB_REPO || 'totalpropertysolutionspro-del/tpspro-website';
// Repo that hosts JARVIS itself — where agent-log.json and blog-index.json live (in public/).
export const JARVIS_REPO = process.env.JARVIS_REPO || 'totalpropertysolutionspro-del/jarvis-app';

export function ghToken(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN not configured');
  return t;
}

function headers() {
  return {
    Authorization: `Bearer ${ghToken()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'jarvis-seo-engine',
  };
}

export interface GhFile {
  content: string; // decoded UTF-8
  sha: string;
}

// Read a file from a repo. Returns null on 404 (file does not exist yet).
export async function getFile(repo: string, path: string, branch = 'main'): Promise<GhFile | null> {
  const url = `${API}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`;
  const r = await fetch(url, { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub getFile ${repo}/${path} failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { content: string; sha: string };
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

// Create or update a file. Pass sha to update an existing file; omit to create.
export async function putFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
  branch = 'main'
): Promise<{ commitSha: string; htmlUrl: string }> {
  const url = `${API}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    committer: { name: 'JARVIS Agent', email: 'jarvis@totalpropertysolution.net' },
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub putFile ${repo}/${path} failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { commit: { sha: string; html_url: string } };
  return { commitSha: data.commit.sha, htmlUrl: data.commit.html_url };
}

export interface AgentLogEntry {
  timestamp: string;
  agentName: string;
  status: 'success' | 'blocked' | 'success_queued';
  actions: string[];
  pagesAffected: string[];
  deployed: boolean;
  blockers?: string[];
}

// Append an entry to public/agent-log.json in the JARVIS repo (newest first),
// keeping the same shape the dashboard's Agent Activity page reads.
export async function appendAgentLog(entry: AgentLogEntry): Promise<void> {
  const path = 'public/agent-log.json';
  const existing = await getFile(JARVIS_REPO, path);
  let log: { lastUpdated: string; entries: AgentLogEntry[] } = { lastUpdated: '', entries: [] };
  if (existing) {
    try {
      log = JSON.parse(existing.content);
    } catch {
      /* corrupt/empty — start fresh rather than throw */
    }
  }
  log.entries = [entry, ...(log.entries || [])].slice(0, 100);
  log.lastUpdated = entry.timestamp.split('T')[0];
  await putFile(
    JARVIS_REPO,
    path,
    JSON.stringify(log, null, 2) + '\n',
    `chore(agent-log): ${entry.agentName} — ${entry.status}`,
    existing?.sha
  );
}

// Map a page slug to its HTML filename in the TPS site repo.
// "" | "/" | "index" -> index.html ; "office-cleaning" -> office-cleaning.html
export function slugToPath(slug: string): string {
  let s = (slug || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (s === '' || s === 'index' || s === 'home') return 'index.html';
  if (!s.endsWith('.html')) s += '.html';
  return s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- request helpers -------------------------------------------------------

export function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-jarvis-token');
}

// Shared-secret gate. These endpoints push to GitHub / post to Google, so they
// must not be open to the public internet. If JARVIS_ACTION_TOKEN is set, every
// mutating request must send a matching x-jarvis-token header (or ?token=).
// Returns true if the request is authorized; otherwise writes 401 and returns false.
export function requireActionToken(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.JARVIS_ACTION_TOKEN;
  if (!expected) {
    // Fail closed: refuse to mutate if no gate is configured.
    res.status(503).json({
      error: 'JARVIS_ACTION_TOKEN is not configured. Set it in the environment to enable write actions.',
    });
    return false;
  }
  const got = (req.headers['x-jarvis-token'] as string) || (req.query.token as string) || '';
  if (got !== expected) {
    res.status(401).json({ error: 'Unauthorized — missing or invalid x-jarvis-token.' });
    return false;
  }
  return true;
}

export function readBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}
