// api/gsc-data.ts
// Fetches Google Search Console data using a service account (no user OAuth needed)
// Service account email must be added as a user in GSC: jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

function getAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

  const sa = JSON.parse(saJson);
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  });
  return auth;
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

  try {
    const auth = getAuth();
    const sc = google.webmasters({ version: 'v3', auth });

    const r = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: 100,
        startRow: 0,
      },
    });

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
    });
  } catch (e: unknown) {
    const msg = String(e);
    // If permission denied, give clear instructions
    if (msg.includes('403') || msg.includes('Permission') || msg.includes('permission')) {
      return res.status(403).json({
        error: 'permission_denied',
        message: 'Service account needs GSC access. Add jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com as a user in Google Search Console.',
        steps: [
          'Go to search.google.com/search-console',
          'Select totalpropertysolution.net',
          'Settings → Users and permissions → Add user',
          'Email: jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com',
          'Permission: Full',
          'Click Add',
        ],
      });
    }
    return res.status(500).json({ error: msg });
  }
}
