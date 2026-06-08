// api/gsc-data.ts
// Fetches Google Search Console data using OAuth2 user credentials (crcp183@gmail.com)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

function getAuth() {
  // Prefer the service account (granted access in Search Console). The OAuth
  // refresh token below can go stale (invalid_grant); the service account is
  // the durable path, so it takes priority.
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const sa = JSON.parse(saJson);
    return new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }

  // Fallback: OAuth2 user credentials (crcp183@gmail.com).
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  throw new Error('No auth credentials configured');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type = 'queries', site, days = '90' } = req.query as Record<string, string>;

  // Status check — with service account, always connected if env var is set
  if (type === 'status') {
    const isConnected = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    return res.json({
      connected: isConnected,
      method: 'service_account',
      account: 'jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com',
    });
  }

  // List available sites
  if (type === 'sites') {
    try {
      const auth = getAuth();
      const sc = google.webmasters({ version: 'v3', auth });
      const r = await sc.sites.list();
      return res.json(r.data);
    } catch (e: unknown) {
      return res.status(500).json({ error: String(e) });
    }
  }

  const siteUrl = site || 'sc-domain:totalpropertysolution.net';
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0];
  const dimension = type === 'pages' ? 'page' : 'query';

  // Empty/awaiting payload helper — keeps the UI in an "awaiting data" state
  // (never fabricated rows) when GSC is slow or not yet granting access.
  const emptyPayload = (source: string, message?: string) => ({
    site: siteUrl,
    startDate,
    endDate,
    dimension,
    totalRows: 0,
    quickWins: 0,
    rows: [] as never[],
    source,
    ...(message ? { message } : {}),
  });

  try {
    const auth = getAuth();
    const sc = google.webmasters({ version: 'v3', auth });

    // 5-second timeout: if GSC is slow, surface "connecting" instead of hanging.
    const queryPromise = sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: 100,
        startRow: 0,
      },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('gsc_timeout')), 5000)
    );

    let r;
    try {
      r = await Promise.race([queryPromise, timeout]);
    } catch (e: unknown) {
      if (String(e).includes('gsc_timeout')) {
        return res.json(emptyPayload('timeout', 'Google Search Console took too long to respond — still connecting.'));
      }
      throw e;
    }

    const rows = (r.data.rows || []).map((row) => ({
      key: row.keys?.[0] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: Math.round((row.ctr ?? 0) * 1000) / 10,
      position: Math.round((row.position ?? 0) * 10) / 10,
      isQuickWin: (row.position ?? 0) >= 8 && (row.position ?? 0) <= 20 && (row.impressions ?? 0) >= 10,
    }));

    return res.json({
      site: siteUrl,
      startDate,
      endDate,
      dimension,
      totalRows: rows.length,
      quickWins: rows.filter((r) => r.isQuickWin).length,
      rows,
      source: 'live',
    });
  } catch (e: unknown) {
    const msg = String(e);
    // No fabricated data. If access isn't granted yet, return an empty
    // "awaiting" payload so the UI shows a connect prompt, not fake rankings.
    if (msg.includes('403') || msg.includes('Permission') || msg.includes('permission') || msg.includes('not_connected')) {
      return res.json(emptyPayload('awaiting', 'Grant the service account access in Google Search Console to see live rankings.'));
    }
    return res.status(500).json({ error: msg });
  }
}
