// api/gbp-post.ts
// Publish a post to the TPS Pro Google Business Profile (local post).
// Uses mybusiness.googleapis.com/v4 localPosts endpoint (confirmed active 2026).
// NOTE: Project must be allowlisted by Google for this API.
// Submit request at: https://support.google.com/business/contact/api_default
//
// POST { message, imageUrl?, ctaType?, ctaUrl? }
//   header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { cors, readBody, requireActionToken, appendAgentLog } from './_lib/github.js';

const VALID_CTA = new Set(['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL']);

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMB_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMB_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMB OAuth env vars not configured');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { token } = await oauth2.getAccessToken();
  if (!token) throw new Error('Failed to obtain GBP access token');
  return token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireActionToken(req, res)) return;

  const accountId = process.env.GBP_ACCOUNT_ID;
  const locationId = process.env.GBP_LOCATION_ID;
  if (!accountId || !locationId) {
    return res.status(503).json({ error: 'GBP_ACCOUNT_ID and GBP_LOCATION_ID must be configured.' });
  }

  const body = readBody(req);
  const message = String(body.message ?? '').trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl) : undefined;
  const ctaUrl = body.ctaUrl ? String(body.ctaUrl) : 'https://totalpropertysolution.net';
  const ctaType = body.ctaType ? String(body.ctaType).toUpperCase() : 'LEARN_MORE';

  if (!message) return res.status(400).json({ error: 'message is required' });
  if (message.length > 1500) return res.status(400).json({ error: 'message exceeds 1500-char limit' });
  if (!VALID_CTA.has(ctaType)) {
    return res.status(400).json({ error: `ctaType must be one of: ${[...VALID_CTA].join(', ')}` });
  }

  const localPost: Record<string, unknown> = {
    languageCode: 'en-US',
    summary: message,
    topicType: 'STANDARD',
  };
  if (ctaType !== 'CALL') localPost.callToAction = { actionType: ctaType, url: ctaUrl };
  else localPost.callToAction = { actionType: 'CALL' };
  if (imageUrl) localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }];

  try {
    const token = await getAccessToken();
    const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(localPost),
    });
    const data = await r.json() as Record<string, unknown>;

    if (!r.ok) {
      return res.status(r.status).json({ error: 'GBP API error', detail: data });
    }

    try {
      await appendAgentLog({
        timestamp: new Date().toISOString(),
        agentName: 'jarvis-gbp-poster',
        status: 'success',
        actions: [
          `Posted to GBP: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`,
          `Post name: ${(data as any).name ?? 'n/a'}`,
        ],
        pagesAffected: ['Google Business Profile'],
        deployed: true,
      });
    } catch { /* non-critical */ }

    return res.json({ ok: true, post: data });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
