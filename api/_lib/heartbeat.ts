// api/_lib/heartbeat.ts
// Live "is this agent running right now" signal, stored in Turso (libsql) so the
// stateless serverless writers and the status reader share one source of truth.
// Files under api/_lib/ start with "_" so Vercel does NOT route them.
//
// Each mutating agent calls markRunning() when it starts and markDone() when it
// finishes. The board reads readHeartbeats() via /api/agent-status. A run whose
// startedAt is older than STALE_MS with no finishedAt is treated as crashed.
import { createClient, type Client } from '@libsql/client';

export const STALE_MS = 90_000;

let _client: Client | null = null;
function db(): Client | null {
  if (!process.env.TURSO_DB_URL || !process.env.TURSO_AUTH_TOKEN) return null;
  if (!_client) {
    _client = createClient({ url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return _client;
}

async function ensure(c: Client): Promise<void> {
  await c.execute(
    `CREATE TABLE IF NOT EXISTS agent_status (
      agent_name TEXT PRIMARY KEY,
      phase TEXT,
      run_id TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      ok INTEGER
    )`
  );
}

// Mark an agent as actively running. phase 'planning' shows a distinct state for
// multi-step agents; 'working' is the default. All best-effort — never throws.
export async function markRunning(agentName: string, phase: 'working' | 'planning' = 'working', runId = ''): Promise<void> {
  try {
    const c = db();
    if (!c) return;
    await ensure(c);
    await c.execute({
      sql: `INSERT INTO agent_status (agent_name, phase, run_id, started_at, finished_at, ok)
            VALUES (?, ?, ?, ?, NULL, NULL)
            ON CONFLICT(agent_name) DO UPDATE SET
              phase=excluded.phase, run_id=excluded.run_id,
              started_at=excluded.started_at, finished_at=NULL, ok=NULL`,
      args: [agentName, phase, runId, Date.now()],
    });
  } catch {
    /* heartbeat is non-critical */
  }
}

export async function markDone(agentName: string, ok: boolean): Promise<void> {
  try {
    const c = db();
    if (!c) return;
    await ensure(c);
    await c.execute({
      sql: `UPDATE agent_status SET finished_at=?, ok=? WHERE agent_name=?`,
      args: [Date.now(), ok ? 1 : 0, agentName],
    });
  } catch {
    /* non-critical */
  }
}

export interface Heartbeat {
  agentName: string;
  phase: string;
  startedAt: number;
  finishedAt: number | null;
  ok: number | null;
}

export async function readHeartbeats(): Promise<Heartbeat[]> {
  try {
    const c = db();
    if (!c) return [];
    await ensure(c);
    const r = await c.execute(`SELECT agent_name, phase, started_at, finished_at, ok FROM agent_status`);
    return r.rows.map((row: any) => ({
      agentName: String(row.agent_name),
      phase: String(row.phase || ''),
      startedAt: Number(row.started_at || 0),
      finishedAt: row.finished_at == null ? null : Number(row.finished_at),
      ok: row.ok == null ? null : Number(row.ok),
    }));
  } catch {
    return [];
  }
}
