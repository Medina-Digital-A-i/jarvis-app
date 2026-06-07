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
    // If permission denied, return realistic demo data so the dashboard is immediately usable
    if (msg.includes('403') || msg.includes('Permission') || msg.includes('permission') || msg.includes('not_connected')) {
      const demoQueries = [
        { key: 'commercial cleaning albany ny', clicks: 34, impressions: 412, ctr: 8.3, position: 3.2, isQuickWin: false },
        { key: 'property maintenance albany', clicks: 22, impressions: 289, ctr: 7.6, position: 4.1, isQuickWin: false },
        { key: 'office cleaning service troy ny', clicks: 18, impressions: 340, ctr: 5.3, position: 6.8, isQuickWin: false },
        { key: 'janitorial services schenectady', clicks: 14, impressions: 198, ctr: 7.1, position: 5.2, isQuickWin: false },
        { key: 'building maintenance capital region', clicks: 11, impressions: 267, ctr: 4.1, position: 9.3, isQuickWin: true },
        { key: 'commercial cleaning saratoga springs', clicks: 9, impressions: 183, ctr: 4.9, position: 8.7, isQuickWin: true },
        { key: 'tps pro llc cleaning', clicks: 8, impressions: 44, ctr: 18.2, position: 2.1, isQuickWin: false },
        { key: 'floor cleaning service albany', clicks: 7, impressions: 156, ctr: 4.5, position: 11.4, isQuickWin: true },
        { key: 'total property solution', clicks: 6, impressions: 38, ctr: 15.8, position: 1.9, isQuickWin: false },
        { key: 'cleaning company clifton park ny', clicks: 6, impressions: 211, ctr: 2.8, position: 14.6, isQuickWin: true },
        { key: 'commercial floor waxing albany', clicks: 5, impressions: 142, ctr: 3.5, position: 13.2, isQuickWin: true },
        { key: 'property upkeep colonie ny', clicks: 4, impressions: 98, ctr: 4.1, position: 16.8, isQuickWin: true },
        { key: 'post construction cleaning ny', clicks: 4, impressions: 176, ctr: 2.3, position: 18.1, isQuickWin: true },
        { key: 'restaurant cleaning service troy', clicks: 3, impressions: 89, ctr: 3.4, position: 15.9, isQuickWin: true },
        { key: 'medical office cleaning capital region', clicks: 3, impressions: 124, ctr: 2.4, position: 19.3, isQuickWin: true },
      ];
      const demoPages = [
        { key: 'https://tpsprollc.com/', clicks: 48, impressions: 621, ctr: 7.7, position: 4.8, isQuickWin: false },
        { key: 'https://tpsprollc.com/services', clicks: 31, impressions: 445, ctr: 7.0, position: 6.1, isQuickWin: false },
        { key: 'https://tpsprollc.com/contact', clicks: 19, impressions: 287, ctr: 6.6, position: 7.4, isQuickWin: false },
        { key: 'https://tpsprollc.com/about', clicks: 12, impressions: 198, ctr: 6.1, position: 9.8, isQuickWin: true },
        { key: 'https://tpsprollc.com/commercial-cleaning', clicks: 8, impressions: 341, ctr: 2.3, position: 13.5, isQuickWin: true },
      ];
      const rows = dimension === 'page' ? demoPages : demoQueries;
      return res.json({
        site: siteUrl,
        startDate,
        endDate,
        dimension,
        totalRows: rows.length,
        quickWins: rows.filter((r) => r.isQuickWin).length,
        rows,
        isDemo: true,
        demoMessage: 'Demo data — add the service account to GSC to see your live rankings',
      });
    }
    return res.status(500).json({ error: msg });
  }
}
