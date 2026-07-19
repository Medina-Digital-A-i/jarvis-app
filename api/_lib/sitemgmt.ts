// api/_lib/sitemgmt.ts
// Shared engine for the autonomous "site management" Routines (blog, GBP, rank,
// citation, competitor). Files under api/_lib/ start with "_" so Vercel does NOT
// turn them into routes.
//
// WHY GITHUB IS THE STORE: these endpoints run on Vercel's serverless runtime,
// whose filesystem is ephemeral and read-only outside /tmp — so they cannot
// write to Miguel's local ~/Documents. The durable, dashboard-readable store in
// this repo is a JSON file committed to the JARVIS repo under public/ (exactly
// how agent-log.json works). So every job appends to public/site-management.json
// here, and ALSO returns the full content + a suggested ~/Documents path so the
// calling Routine (a Claude agent) can drop a local mirror copy itself.
import Anthropic from '@anthropic-ai/sdk';
import { getFile, putFile, JARVIS_REPO } from './github.js';

// Cost-conscious default: Haiku 4.5 (fast, cheap, no reasoning needed for these
// jobs). Decoupled from JARVIS_AI_MODEL so the Routines stay on Haiku regardless
// of the shared editor model. Override per-deploy with JARVIS_ROUTINE_MODEL.
export const ROUTINE_MODEL = process.env.JARVIS_ROUTINE_MODEL || 'claude-haiku-4-5-20251001';

export type JobKind = 'blog' | 'gbp' | 'rank' | 'citation' | 'competitor';
export type ItemStatus = 'draft_awaiting_approval' | 'published' | 'rejected' | 'report';

export interface SiteMgmtItem {
  id: string;
  kind: JobKind;
  status: ItemStatus;
  date: string; // ISO timestamp
  siteId: string;
  title: string;
  summary: string; // one-liner for the dashboard feed
  body: string; // full markdown (what gets mirrored to ~/Documents)
  localPath: string; // suggested mirror path, relative to 07-Marketing-Web/
  meta?: Record<string, unknown>; // per-kind extras (slug, targetKeyword, movers…)
}

export interface SiteMgmtStore {
  lastUpdated: string;
  items: SiteMgmtItem[];
}

const QUEUE_PATH = 'public/site-management.json';
const MAX_AGE_DAYS = 30;
const MAX_ITEMS = 200;

// --- killswitch ------------------------------------------------------------
// Auto-publish (any write to the live GitHub site) is ON unless the env var is
// the exact string "false". Flip it in Vercel → Settings → Environment Variables
// and redeploy to freeze all publishing without touching code.
export function autoPublishEnabled(): boolean {
  return process.env.JARVIS_AUTO_PUBLISH_ENABLED !== 'false';
}

// --- small helpers ---------------------------------------------------------
export function yyyymmdd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function newId(kind: JobKind): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const rand =
    typeof c?.randomUUID === 'function' ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${kind}-${yyyymmdd()}-${rand}`;
}

export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const DIR: Record<JobKind, string> = {
  blog: 'blog-drafts',
  gbp: 'gbp-drafts',
  rank: 'rank-reports',
  citation: 'citation-audits',
  competitor: 'competitor-scans',
};

// Suggested local mirror path (relative to ~/Documents/Businesses/TPS/07-Marketing-Web).
export function localPathFor(kind: JobKind, slug?: string): string {
  const stamp = yyyymmdd();
  if (kind === 'blog') return `${DIR.blog}/${stamp}-${slug || 'post'}.md`;
  if (kind === 'gbp') return `${DIR.gbp}/${stamp}.md`;
  return `${DIR[kind]}/${stamp}.md`;
}

// --- persistence (GitHub-backed, mirrors appendAgentLog) -------------------
export async function readQueue(): Promise<SiteMgmtStore> {
  const existing = await getFile(JARVIS_REPO, QUEUE_PATH);
  if (!existing) return { lastUpdated: '', items: [] };
  try {
    const parsed = JSON.parse(existing.content) as SiteMgmtStore;
    return { lastUpdated: parsed.lastUpdated || '', items: parsed.items || [] };
  } catch {
    return { lastUpdated: '', items: [] };
  }
}

// Keep pending approvals forever; prune everything else past 30 days, cap size.
function prune(items: SiteMgmtItem[]): SiteMgmtItem[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  return items
    .filter((it) => it.status === 'draft_awaiting_approval' || new Date(it.date).getTime() >= cutoff)
    .slice(0, MAX_ITEMS);
}

// Append a new item (newest first) and commit. dryRun skips the commit entirely
// (used for safe testing) and just returns the item that WOULD be written.
export async function appendItem(item: SiteMgmtItem, opts: { dryRun?: boolean } = {}): Promise<void> {
  if (opts.dryRun) return;
  const existing = await getFile(JARVIS_REPO, QUEUE_PATH);
  let store: SiteMgmtStore = { lastUpdated: '', items: [] };
  if (existing) {
    try {
      store = JSON.parse(existing.content) as SiteMgmtStore;
    } catch {
      /* corrupt — start fresh rather than throw */
    }
  }
  store.items = prune([item, ...(store.items || [])]);
  store.lastUpdated = item.date.slice(0, 10);
  await putFile(
    JARVIS_REPO,
    QUEUE_PATH,
    JSON.stringify(store, null, 2) + '\n',
    `chore(site-mgmt): ${item.kind} — ${item.status} [JARVIS]`,
    existing?.sha
  );
}

// Patch an existing item in place (e.g. draft_awaiting_approval → published).
export async function updateItem(
  id: string,
  patch: Partial<SiteMgmtItem>
): Promise<SiteMgmtItem | null> {
  const existing = await getFile(JARVIS_REPO, QUEUE_PATH);
  if (!existing) return null;
  let store: SiteMgmtStore;
  try {
    store = JSON.parse(existing.content) as SiteMgmtStore;
  } catch {
    return null;
  }
  const idx = (store.items || []).findIndex((it) => it.id === id);
  if (idx < 0) return null;
  store.items[idx] = { ...store.items[idx], ...patch };
  store.lastUpdated = new Date().toISOString().slice(0, 10);
  await putFile(
    JARVIS_REPO,
    QUEUE_PATH,
    JSON.stringify(store, null, 2) + '\n',
    `chore(site-mgmt): update ${id} → ${patch.status || 'patched'} [JARVIS]`,
    existing.sha
  );
  return store.items[idx];
}

export async function getItem(id: string): Promise<SiteMgmtItem | null> {
  const store = await readQueue();
  return store.items.find((it) => it.id === id) || null;
}

// --- AI generation (Haiku + prompt caching) --------------------------------
// Returns '' when no API key is configured, so every caller can fall back to a
// deterministic template and the unattended Routine never hard-fails.
export async function generate(system: string, user: string, maxTokens = 1400): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return '';
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create(
      {
        model: ROUTINE_MODEL,
        max_tokens: maxTokens,
        // System prompt is static per job → cache it (matches the Telegram brain).
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      },
      { timeout: 30000 }
    );
    return msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
  } catch {
    return '';
  }
}

// --- blog publish payload --------------------------------------------------
// Map a queued blog draft to the body /api/publish-blog expects. The generated
// HTML article body lives in meta.contentHtml; the rest are SEO fields.
export interface PublishPayload {
  title: string;
  slug: string;
  content: string;
  targetKeyword: string;
  metaDescription: string;
  excerpt: string;
}

export function buildPublishPayload(item: SiteMgmtItem): PublishPayload | null {
  if (item.kind !== 'blog') return null;
  const m = (item.meta || {}) as Record<string, string>;
  const content = m.contentHtml || '';
  if (!item.title || !content || !m.metaDescription) return null;
  return {
    title: item.title,
    slug: m.slug || slugify(item.title),
    content,
    targetKeyword: m.targetKeyword || '',
    metaDescription: m.metaDescription,
    excerpt: m.excerpt || m.metaDescription,
  };
}
