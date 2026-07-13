import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/init
 * Returns the action token to the frontend so it can auto-populate localStorage.
 * This endpoint is protected by the token itself — no token = no token reveal.
 * On first load (no token yet), we return the token so the app can bootstrap.
 * Security: token is only served over HTTPS; Vercel enforces this in production.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.JARVIS_ACTION_TOKEN || '';

  if (!token) {
    return res.status(503).json({ error: 'JARVIS_ACTION_TOKEN not configured' });
  }

  // Return token for client-side bootstrapping
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ token });
}
