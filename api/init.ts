import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/init
 * Personal tool — returns JARVIS_ACTION_TOKEN for auto-bootstrap.
 * No public login needed; URL is private/obscure.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const token = process.env.JARVIS_ACTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'Token not configured' });
  return res.status(200).json({ token });
}
