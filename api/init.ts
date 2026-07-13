import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/init
 * DISABLED — public token exposure removed.
 * Token bootstrap will be re-enabled once Clerk login is active
 * (token will only be served to authenticated sessions).
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(404).json({ error: 'Not found' });
}
