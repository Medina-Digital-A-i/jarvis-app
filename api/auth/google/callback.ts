// api/auth/google/callback.ts
// Step 2: Google redirects here with auth code → exchange for tokens → store in Turso
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

async function getTurso() {
  const client = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  // Ensure table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS jarvis_tokens (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return client;
}

async function saveToken(key: string, value: string) {
  const db = await getTurso();
  await db.execute({
    sql: `INSERT INTO jarvis_tokens (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    args: [key, value, new Date().toISOString()],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error || !code || typeof code !== 'string') {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>❌ Google Auth Failed</h2>
        <p>${error || 'No code returned'}</p>
        <a href="/">← Back to JARVIS</a>
      </body></html>
    `);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `https://${req.headers.host}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (tokens.error || !tokens.access_token) {
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>❌ Token Exchange Failed</h2>
        <p>${JSON.stringify(tokens)}</p>
        <a href="/">← Back to JARVIS</a>
      </body></html>
    `);
  }

  // Save tokens to Turso
  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await saveToken('google_access_token', tokens.access_token);
  await saveToken('google_token_expiry', expiry);
  if (tokens.refresh_token) {
    await saveToken('google_refresh_token', tokens.refresh_token);
  }

  // Get Google user info to confirm who connected
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userRes.json() as { email?: string };

  return res.status(200).send(`
    <html>
    <head>
      <meta http-equiv="refresh" content="3;url=/google/search-console">
      <style>
        body { font-family: sans-serif; background: #0f0f13; color: white; display: flex;
               justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; }
        h2 { color: #34d399; margin-bottom: 8px; }
        p { color: rgba(255,255,255,0.5); margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h2>Google Connected</h2>
        <p>${user.email ?? 'Account linked'}</p>
        <p style="margin-top:16px;font-size:13px">Redirecting to Search Console…</p>
      </div>
    </body>
    </html>
  `);
}
