// api/gbp-post.ts
// Publish a post to the TPS Pro Google Business Profile (local post) to boost
// local SEO. Uses the GMB OAuth credentials (refresh-token flow) to mint an
// access token, then calls the Business Profile v5 localPosts endpoint.
//
// POST { message, imageUrl?, ctaType?, ctaUrl? }
//   header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
//
// Required env: GMB_OAUTH_CLIENT_ID, GMB_OAUTH_CLIENT_SECRET, GMB_OAUTH_REFRESH_TOKEN,
//               GBP_ACCOUNT_ID, GBP_LOCATION_ID
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { cors, readBody, requireActionToken, appendAgentLog } from './_lib/github.js';

const VALID_CTA = new Set(['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL']);

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMB_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMB_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMB OAuth env vars not configured (GMB_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN)');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { token } = await oauth2.getAccessToken();
  if (!token) throw new Error('Failed to obtain GBP access token (refresh token may be stale)');
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
  if (message.length > 1500) return res.status(400).json({ error: 'message exceeds GBP 1500-char limit' });
  if (ctaType && !VALID_CTA.has(ctaType)) {
    return res.status(400).json({ error: `ctaType must be one of: ${[...VALID_CTA].join(', ')}` });
  }

  const localPost: Record<string, unknown> = {
    languageCode: 'en-US',
    summary: message,
    topicType: 'STANDARD',
  };
  if (ctaType && ctaType !== 'CALL') localPost.callToAction = { actionType: ctaType, url: ctaUrl };
  if (ctaType === 'CALL') localPost.callToAction = { actionType: 'CALL' };
  if (imageUrl) localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }];

  try {
    const token = await getAccessToken();
    // Use v5 Business Profile API (v4 mybusiness.googleapis.com is deprecated)
    const locationName = `accounts/${accountId}/locations/${locationId}`;
    const url = `https://businessprofileperformance.googleapis.com/v1/${locationName}/localPosts`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(localPost),
    });
    const data = await r.json() as Record<string, unknown>;

    // Fallback to mybusinessaccountmanagement v1 if performance API doesn't support posts
    if (!r.ok) {
      const url2 = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}/localPosts`;
      const r2 = await fetch(url2, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(localPost),
      });
      const data2 = await r2.json() as Record<string, unknown>;
      if (!r2.ok) {
        return res.status(r2.status).json({ error: 'GBP API error', detail: data2, also: data });
      }
      return res.json({ ok: true, post: data2, api: 'mybusinessaccountmanagement/v1' });
    }

    try {
      await appendAgentLog({
        timestamp: new Date().toISOString(),
        agentName: 'jarvis-gbp-poster',
        status: 'success',
        actions: [
          `Posted to Google Business Profile: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`,
          imageUrl ? `With image: ${imageUrl}` : 'No image',
          `Post: ${(data as any).name ?? '(name n/a)'}`,
        ].filter(Boolean),
        pagesAffected: ['Google Business Profile'],
        deployed: true,
      });
    } catch {
      /* non-critical */
    }

    return res.json({ ok: true, post: data, api: 'businessprofileperformance/v1' });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
