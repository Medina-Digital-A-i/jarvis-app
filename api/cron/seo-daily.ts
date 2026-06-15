// api/cron/seo-daily.ts
// The always-on trigger. Vercel Cron hits this GET endpoint on a schedule (see
// vercel.json) so the daily SEO loop runs in production whether or not Miguel's
// Mac is awake — replacing the local Claude scheduler as the source of truth.
//
// It runs the same two steps the jarvis-daily-seo-audit skill does:
//   1. GET  /api/seo-audit       — read-only score for totalpropertysolution.net
//   2. POST /api/seo-autopilot   — autonomously commit on-page SEO fixes
// then writes ONE daily-audit entry to the agent log. (The autopilot writes its
// own entry for the fixes it commits, so we only summarize the audit here.)
//
// Auth — accepts EITHER:
//   • Vercel Cron's  Authorization: Bearer ${CRON_SECRET}  header, OR
//   • a manual trigger with  x-jarvis-token: ${JARVIS_ACTION_TOKEN}
// so you can also fire it by hand to test.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appendAgentLog } from '../_lib/github.js';

// Audit + up to 5 commits over ~30 pages. Hobby caps at 60s.
export const config = { maxDuration: 60 };

const SITE_URL = process.env.SITE_BASE_URL || 'https://totalpropertysolution.net';
const MAX_CHANGES = Number(process.env.SEO_AUTOPILOT_MAX_CHANGES || 5);

// Resolve the base URL for calling our own sibling functions. In production
// VERCEL_URL is the deployment host (no protocol); PUBLIC_BASE_URL can override.
function selfBase(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// Cron requests carry the platform secret; manual requests carry the action token.
function authorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`) return true;
  const actionToken = process.env.JARVIS_ACTION_TOKEN;
  const got = (req.headers['x-jarvis-token'] as string) || (req.query.token as string) || '';
  if (actionToken && got === actionToken) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized — cron secret or x-jarvis-token required.' });
  }

  const base = selfBase();
  const startedAt = new Date().toISOString();
  const actions: string[] = [];
  const blockers: string[] = [];
  let score: number | null = null;
  let errorCount = 0;
  let warningCount = 0;

  // --- Step 1: audit (read-only) -------------------------------------------
  try {
    const r = await fetch(`${base}/api/seo-audit?url=${encodeURIComponent(SITE_URL)}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const data = (await r.json()) as { score?: number; issues?: Array<{ type: string }> };
      score = typeof data.score === 'number' ? data.score : null;
      errorCount = (data.issues || []).filter((i) => i.type === 'error').length;
      warningCount = (data.issues || []).filter((i) => i.type === 'warning').length;
      actions.push(`Ran SEO audit against ${SITE_URL}`);
      actions.push(`Score: ${score ?? 'n/a'}/100 — errors: ${errorCount}, warnings: ${warningCount}`);
    } else {
      blockers.push(`Audit call failed: ${r.status} ${await r.text()}`);
    }
  } catch (e: unknown) {
    blockers.push(`Audit call threw: ${String(e)}`);
  }

  // --- Step 2: autopilot (commits its own fixes + logs its own entry) ------
  let pagesFixed = 0;
  let totalFixes = 0;
  const actionToken = process.env.JARVIS_ACTION_TOKEN;
  if (!actionToken) {
    blockers.push('JARVIS_ACTION_TOKEN not set — skipped autopilot (writes are gated).');
  } else {
    try {
      const r = await fetch(`${base}/api/seo-autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': actionToken },
        body: JSON.stringify({ maxChanges: MAX_CHANGES }),
        signal: AbortSignal.timeout(55000),
      });
      if (r.ok) {
        const data = (await r.json()) as { pagesFixed?: number; totalFixes?: number };
        pagesFixed = data.pagesFixed ?? 0;
        totalFixes = data.totalFixes ?? 0;
        actions.push(`Autopilot: fixed ${totalFixes} issue(s) across ${pagesFixed} page(s)`);
      } else {
        blockers.push(`Autopilot call failed: ${r.status} ${await r.text()}`);
      }
    } catch (e: unknown) {
      blockers.push(`Autopilot call threw: ${String(e)}`);
    }
  }

  // --- log one daily-audit entry (autopilot logs its own fix entry) --------
  const ok = blockers.length === 0;
  try {
    await appendAgentLog({
      timestamp: startedAt,
      agentName: 'jarvis-daily-seo-audit',
      status: ok ? 'success' : 'blocked',
      actions: actions.length ? actions : ['Daily SEO cron ran but produced no audit data'],
      pagesAffected: [SITE_URL],
      deployed: pagesFixed > 0,
      ...(blockers.length ? { blockers } : {}),
    });
  } catch (e: unknown) {
    blockers.push(`Agent-log write failed: ${String(e)}`);
  }

  return res.status(ok ? 200 : 207).json({
    ok,
    startedAt,
    score,
    errorCount,
    warningCount,
    pagesFixed,
    totalFixes,
    blockers,
  });
}
