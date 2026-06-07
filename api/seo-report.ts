// api/seo-report.ts
// Aggregated SEO report endpoint — fetches 7d + 28d GSC data and computes
// quickWins, topKeywords, topMovers, coverageScore, and zeroClickOpportunities.
// Used by the scheduled weekly task and the SeoReport.tsx dashboard page.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_KEYWORDS = [
  'commercial cleaning albany ny',
  'janitorial services albany ny',
  'cleaning services albany ny',
  'post construction cleaning albany ny',
  'office cleaning albany ny',
  'make ready cleaning albany ny',
  'student housing cleaning albany ny',
  'commercial cleaning saratoga springs ny',
  'building cleanout albany ny',
  'albany commercial cleaning',
];

function getAuth() {
  // Prefer the service account (durable); fall back to OAuth only if no SA set.
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const sa = JSON.parse(saJson);
    return new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }
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

async function fetchGscRows(days: number, siteUrl: string) {
  const auth = getAuth();
  const sc = google.webmasters({ version: 'v3', auth });
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const r = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 500,
    },
  });

  return {
    startDate,
    endDate,
    rows: (r.data.rows || []).map((row) => ({
      key: row.keys?.[0] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: Math.round((row.ctr ?? 0) * 1000) / 10,
      position: Math.round((row.position ?? 0) * 10) / 10,
    })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const siteUrl = (req.query.site as string) || 'sc-domain:totalpropertysolution.net';

  try {
    const [data28, data7] = await Promise.all([
      fetchGscRows(28, siteUrl),
      fetchGscRows(7, siteUrl),
    ]);

    const rows28 = data28.rows;
    const rows7 = data7.rows;

    // Coverage score
    const coverageDetails = TARGET_KEYWORDS.map((kw) => {
      const row = rows28.find((r) => r.key.toLowerCase().includes(kw.toLowerCase()));
      return {
        keyword: kw,
        position: row?.position ?? null,
        clicks: row?.clicks ?? 0,
        impressions: row?.impressions ?? 0,
        onPage1: row ? row.position <= 10 : false,
        ranked: !!row,
      };
    });
    const coverageScore = coverageDetails.filter((c) => c.onPage1).length;

    // Quick wins (28d)
    const quickWins = rows28
      .filter((r) => r.position >= 8 && r.position <= 20 && r.impressions >= 5)
      .sort((a, b) => a.position - b.position)
      .slice(0, 10);

    // Top movers (7d improved vs 28d)
    const topMovers = rows7
      .map((r7) => {
        const r28 = rows28.find((r) => r.key === r7.key);
        const delta = r28 ? Math.round((r28.position - r7.position) * 10) / 10 : null;
        return { key: r7.key, position7d: r7.position, position28d: r28?.position ?? null, delta };
      })
      .filter((r) => r.delta !== null && r.delta > 0)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 8);

    // Zero-click opportunities (28d)
    const zeroClickOpportunities = rows28
      .filter((r) => r.clicks === 0 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 8);

    // Top keywords (28d, by clicks)
    const topKeywords = rows28
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const report = {
      generatedAt: new Date().toISOString(),
      period: { days28: { startDate: data28.startDate, endDate: data28.endDate }, days7: { startDate: data7.startDate, endDate: data7.endDate } },
      coverageScore,
      coverageDetails,
      quickWins,
      topMovers,
      zeroClickOpportunities,
      topKeywords,
      summary: {
        totalKeywords28d: rows28.length,
        totalClicks28d: rows28.reduce((s, r) => s + r.clicks, 0),
        totalImpressions28d: rows28.reduce((s, r) => s + r.impressions, 0),
        quickWinCount: quickWins.length,
        topMoverCount: topMovers.length,
        zeroClickCount: zeroClickOpportunities.length,
        targetKeywordsOnPage1: coverageScore,
        targetKeywordsTotal: TARGET_KEYWORDS.length,
      },
    };

    return res.json(report);
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
