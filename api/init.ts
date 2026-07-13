import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';

/**
 * GET /api/init
 * Returns JARVIS_ACTION_TOKEN **only** to authenticated Clerk sessions.
 * Unauthenticated requests get 401.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  // If Clerk isn't configured, gate is closed entirely.
  if (!publishableKey || !secretKey) {
    return res.status(404).json({ error: 'Not found' });
  }

  const clerk = createClerkClient({ secretKey });

  try {
    // Extract session token from Authorization header or __session cookie
    const sessionToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      (req.cookies as Record<string, string>)?.__session ||
      '';

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify with Clerk
    const payload = await clerk.verifyToken(sessionToken, { authorizedParties: [] });
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.JARVIS_ACTION_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token not configured' });
  }

  return res.status(200).json({ token });
}
