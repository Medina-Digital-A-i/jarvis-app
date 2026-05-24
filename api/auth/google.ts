// api/auth/google.ts
// Step 1: redirect user to Google consent screen
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `https://${req.headers.host}/api/auth/google/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: 'jarvis-oauth',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return res.redirect(302, authUrl);
}
