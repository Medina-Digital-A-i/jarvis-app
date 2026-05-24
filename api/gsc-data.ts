// api/gsc-data.ts
// Fetches Google Search Console data using stored tokens
// Auto-refreshes access token when expired
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const DB_URL = process.env.TURSO_DB_URL!;
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN!;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

async function getDb() {
  return createClient({ url: DB_URL, authToken: DB_TOKEN });
}

async function getToken(key: string): Promise<string | null> {
  const db = await getDb();
  try {
    const r = await db.execute({ sql: 'SELECT value FROM jarvis_tokens WHERE key = ?', args: [key] });
    return r.rows[0]?.[0] as string ?? null;
  } catch {
    return null;
  }
}

async function saveToken(key: string, value: string) {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO jarvis_tokens (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    args: [key, value, new Date().toISOString()],
  });
}

async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await getToken('google_access_token');
  const expiry = await getToken('google_token_expiry');
  const refreshToken = await getToken('google_refresh_token');

  if (!accessToken) return null;

  // If token is still valid (with 5-minute buffer), return it
  if (expiry && new Date(expiry).getTime() - 5 * 60 * 1000 > Date.now()) {
    return accessToken;
  }

  // Token expired — refresh it
  if (!refreshToken) return null;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await r.json() as { access_token?: string; expires_in?: number; error?: string };
  if (data.error || !data.access_token) return null;

  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await saveToken('google_access_token', data.access_token);
  await saveToken('google_token_expiry', newExpiry);
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { type = 'queries', site, days = '90' } = req.query as Record<string, string>;

  // Check connection status
  if (type === 'status') {
    const token = await getToken('google_access_token');
    const expiry = await getToken('google_token_expiry');
    const refresh = await getToken('google_refresh_token');
    return res.json({
      connected: !!token && !!refresh,
      expiry,
      hasRefresh: !!refresh,
    });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return res.status(401).json({ error: 'not_connected', message: 'Google account not connected' });
  }

  // List available sites
  if (type === 'sites') {
    const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await r.json();
    return res.json(data);
  }

  // Query search analytics
  const siteUrl = site || 'sc-domain:totalpropertysolution.net';
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0];

  const dimension = type === 'pages' ? 'page' : 'query';

  const body = {
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit: 100,
    startRow: 0,
  };

  const r = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!r.ok) {
    const err = await r.text();
    return res.status(r.status).json({ error: err });
  }

  const data = await r.json() as { rows?: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }> };

  // Annotate quick-win keywords (pos 8-20, >10 impressions)
  const rows = (data.rows || []).map((row) => ({
    key: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 1000) / 10, // percentage, 1 decimal
    position: Math.round(row.position * 10) / 10,
    isQuickWin: row.position >= 8 && row.position <= 20 && row.impressions >= 10,
  }));

  return res.json({
    site: siteUrl,
    startDate,
    endDate,
    dimension,
    totalRows: rows.length,
    quickWins: rows.filter((r) => r.isQuickWin).length,
    rows,
  });
}
