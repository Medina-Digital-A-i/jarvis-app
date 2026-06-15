// api/_lib/sites.ts
// The multi-site registry. Every site JARVIS manages lives here (Turso/libsql),
// so the dashboard and every agent can look up a site's config by id instead of
// the old hardcoded TPS-Pro constants. Files under api/_lib/ aren't routed.
//
// platform drives what's possible:
//   'github' → full power: audit, rankings, AND autonomous fixes (commits to repo)
//   'wix' / 'other' → audit + rankings only (no repo to commit fixes to)
import { createClient, type Client } from '@libsql/client';

export interface SiteConfig {
  id: string;
  label: string;
  domain: string;
  baseUrl: string;
  platform: 'github' | 'wix' | 'other';
  gscProperty: string | null; // e.g. "sc-domain:example.com"
  githubRepo: string | null; // e.g. "owner/repo" (null for non-github)
  brand: string;
  brandShort: string;
  phone: string;
  region: string;
  active: boolean;
}

// Sites that ship pre-registered so existing TPS automation keeps working and
// Pour Decisions shows up immediately. Inserted once if the table is empty.
const SEED: SiteConfig[] = [
  {
    id: 'tps',
    label: 'TPS Pro',
    domain: 'totalpropertysolution.net',
    baseUrl: 'https://totalpropertysolution.net',
    platform: 'github',
    gscProperty: 'sc-domain:totalpropertysolution.net',
    githubRepo: 'totalpropertysolutionspro-del/tpspro-website',
    brand: 'TPS Pro LLC',
    brandShort: 'TPS Pro',
    phone: '(518) 948-7156',
    region: 'Albany & the Capital Region',
    active: true,
  },
  {
    id: 'pour',
    label: 'Pour Decisions',
    domain: 'pourdecisionsjuicebar.com',
    baseUrl: 'https://pourdecisionsjuicebar.com',
    platform: 'wix',
    gscProperty: null,
    githubRepo: null,
    brand: 'Pour Decisions',
    brandShort: 'Pour Decisions',
    phone: '',
    region: 'Albany, NY',
    active: true,
  },
];

let _client: Client | null = null;
function db(): Client | null {
  if (!process.env.TURSO_DB_URL || !process.env.TURSO_AUTH_TOKEN) return null;
  if (!_client) _client = createClient({ url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return _client;
}

async function ensure(c: Client): Promise<void> {
  await c.execute(
    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      domain TEXT NOT NULL,
      base_url TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'other',
      gsc_property TEXT,
      github_repo TEXT,
      brand TEXT,
      brand_short TEXT,
      phone TEXT,
      region TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    )`
  );
  const count = await c.execute(`SELECT COUNT(*) AS n FROM sites`);
  if (Number((count.rows[0] as any).n) === 0) {
    for (const s of SEED) await insert(c, s);
  }
}

async function insert(c: Client, s: SiteConfig): Promise<void> {
  await c.execute({
    sql: `INSERT INTO sites (id, label, domain, base_url, platform, gsc_property, github_repo, brand, brand_short, phone, region, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            label=excluded.label, domain=excluded.domain, base_url=excluded.base_url, platform=excluded.platform,
            gsc_property=excluded.gsc_property, github_repo=excluded.github_repo, brand=excluded.brand,
            brand_short=excluded.brand_short, phone=excluded.phone, region=excluded.region, active=excluded.active`,
    args: [s.id, s.label, s.domain, s.baseUrl, s.platform, s.gscProperty, s.githubRepo, s.brand, s.brandShort, s.phone, s.region, s.active ? 1 : 0, Date.now()],
  });
}

function rowToSite(r: any): SiteConfig {
  return {
    id: String(r.id),
    label: String(r.label),
    domain: String(r.domain),
    baseUrl: String(r.base_url),
    platform: (String(r.platform) as SiteConfig['platform']) || 'other',
    gscProperty: r.gsc_property == null ? null : String(r.gsc_property),
    githubRepo: r.github_repo == null ? null : String(r.github_repo),
    brand: String(r.brand ?? r.label),
    brandShort: String(r.brand_short ?? r.label),
    phone: String(r.phone ?? ''),
    region: String(r.region ?? ''),
    active: Number(r.active ?? 1) === 1,
  };
}

// Fallback used when Turso isn't reachable — keeps the app working read-only.
function fallback(): SiteConfig[] {
  return SEED;
}

export async function listSites(): Promise<SiteConfig[]> {
  const c = db();
  if (!c) return fallback();
  try {
    await ensure(c);
    const r = await c.execute(`SELECT * FROM sites WHERE active = 1 ORDER BY created_at ASC`);
    return r.rows.map(rowToSite);
  } catch {
    return fallback();
  }
}

export async function getSite(id: string): Promise<SiteConfig | null> {
  const sites = await listSites();
  return sites.find((s) => s.id === id) || null;
}

// Resolve a site for an agent run: explicit id, else the first site (TPS).
export async function resolveSite(id?: string | null): Promise<SiteConfig> {
  const sites = await listSites();
  if (id) {
    const hit = sites.find((s) => s.id === id);
    if (hit) return hit;
  }
  return sites[0] || SEED[0];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'site';
}

export async function addSite(input: Partial<SiteConfig> & { domain: string; label: string }): Promise<SiteConfig> {
  const c = db();
  if (!c) throw new Error('Site registry unavailable (Turso not configured)');
  await ensure(c);
  const domain = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const platform: SiteConfig['platform'] = input.platform || (input.githubRepo ? 'github' : 'other');
  const site: SiteConfig = {
    id: input.id?.trim() || slugify(input.label || domain),
    label: input.label,
    domain,
    baseUrl: input.baseUrl || `https://${domain}`,
    platform,
    gscProperty: input.gscProperty || null,
    githubRepo: input.githubRepo || null,
    brand: input.brand || input.label,
    brandShort: input.brandShort || input.label,
    phone: input.phone || '',
    region: input.region || '',
    active: true,
  };
  await insert(c, site);
  return site;
}

export async function deleteSite(id: string): Promise<void> {
  const c = db();
  if (!c) throw new Error('Site registry unavailable (Turso not configured)');
  await ensure(c);
  await c.execute({ sql: `UPDATE sites SET active = 0 WHERE id = ?`, args: [id] });
}
