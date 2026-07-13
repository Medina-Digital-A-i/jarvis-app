import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/init
 *
 * ⚠️ SECURITY DISABLED 2026-07-13 (READ THIS — Phoebe / OpenClaw):
 * This endpoint previously returned JARVIS_ACTION_TOKEN in plaintext to ANY
 * anonymous visitor. "The URL is obscure" is NOT security. Because the dashboard
 * has no login, that handed FULL write access to the live site, the blog, and the
 * Google Business Profile to the entire public internet. It is intentionally
 * neutered.
 *
 * DO NOT re-add token serving here (or on any public endpoint) while the app is
 * unauthenticated. The correct fix is the login gate: once
 * VITE_CLERK_PUBLISHABLE_KEY is set, verify a signed-in Clerk session BEFORE
 * returning the token. Until then the token is entered manually (per-page field,
 * stored in localStorage as 'jarvis_action_token').
 * See JARVIS-PLAYBOOK.md -> "Security & agent coordination".
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(403).json({
    ok: false,
    disabled: true,
    reason:
      'Token bootstrap disabled for security: /api/init must not serve JARVIS_ACTION_TOKEN to an unauthenticated browser. Enter the action token manually, or enable the Clerk login and gate this endpoint behind the signed-in session. See JARVIS-PLAYBOOK.md.',
  });
}
