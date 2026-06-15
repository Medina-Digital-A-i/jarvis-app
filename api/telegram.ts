// api/telegram.ts
// JARVIS Telegram bot webhook. Telegram POSTs every message / button tap here.
// Lets the owner SEE and COMMAND the agents from their phone:
//
//   /start        register + show your chat id
//   /status       last 5 agent-log entries
//   /audit        run the SEO audit, reply with score
//   /fix [n]      run the autopilot, fixing up to n pages (default 5)
//   /help         list commands
//
// Security:
//   - Telegram sends a secret in X-Telegram-Bot-Api-Secret-Token (set via setWebhook).
//     We verify it against TELEGRAM_WEBHOOK_SECRET when configured.
//   - Once TELEGRAM_CHAT_ID is set, only that chat may issue commands.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTelegram, answerCallback } from './_lib/telegram.js';
import { readBody } from './_lib/github.js';

export const config = { maxDuration: 60 };

function baseUrl(req: VercelRequest): string {
  const host = req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return `${proto}://${host}`;
}

const HELP = [
  '🤖 *JARVIS commands*',
  '/status — recent agent activity',
  '/audit — run an SEO audit now',
  '/fix [n] — autopilot: fix up to n pages (default 5)',
  '/help — this list',
].join('\n');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Telegram's secret header when one is configured.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, info: 'JARVIS Telegram webhook is live.' });
  }

  const update = readBody(req);
  const msg = (update.message || update.edited_message) as Record<string, any> | undefined;
  const cb = update.callback_query as Record<string, any> | undefined;
  const chatId = String(msg?.chat?.id || cb?.message?.chat?.id || '');
  const text = String(msg?.text || cb?.data || '').trim();

  // Always 200 to Telegram quickly even if we bail — otherwise it retries.
  if (!chatId) return res.status(200).json({ ok: true });

  const owner = process.env.TELEGRAM_CHAT_ID;
  // Before an owner is registered, reply to anyone with their chat id so it can
  // be locked in. After registration, ignore everyone except the owner.
  if (owner && chatId !== owner) {
    await sendTelegram('🔒 This JARVIS bot is private.', { chatId });
    if (cb) await answerCallback(cb.id);
    return res.status(200).json({ ok: true });
  }

  const base = baseUrl(req);
  const actionToken = process.env.JARVIS_ACTION_TOKEN || '';
  const parts = text.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();

  try {
    if (cmd === '/start') {
      await sendTelegram(
        `👋 *JARVIS online.*\nYour chat id is \`${chatId}\`.\n\n${HELP}`,
        { chatId, parseMode: 'Markdown' }
      );
    } else if (cmd === '/help') {
      await sendTelegram(HELP, { chatId, parseMode: 'Markdown' });
    } else if (cmd === '/status') {
      const log = await fetch(`${base}/agent-log.json`, { headers: { 'cache-control': 'no-cache' } })
        .then((r) => r.json())
        .catch(() => ({ entries: [] }));
      const lines = (log.entries || [])
        .slice(0, 5)
        .map((e: any) => `• ${String(e.timestamp || '').slice(0, 16).replace('T', ' ')} — ${e.agentName} (${e.status})`)
        .join('\n');
      await sendTelegram(`📊 *Recent agent activity*\n${lines || '_no entries yet_'}`, { chatId, parseMode: 'Markdown' });
    } else if (cmd === '/audit') {
      const a = await fetch(`${base}/api/seo-audit?url=https://totalpropertysolution.net`).then((r) => r.json());
      const errs = (a.issues || []).filter((i: any) => i.type === 'error').length;
      const warns = (a.issues || []).filter((i: any) => i.type === 'warning').length;
      await sendTelegram(`🔍 *SEO audit*\nScore: *${a.score}/100*\nErrors: ${errs} · Warnings: ${warns}`, {
        chatId,
        parseMode: 'Markdown',
      });
    } else if (cmd === '/fix') {
      const n = Math.max(1, Math.min(40, Number(parts[1] || 5)));
      await sendTelegram(`⚙️ Running autopilot — fixing up to ${n} page(s)…`, { chatId });
      const r = await fetch(`${base}/api/seo-autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': actionToken },
        body: JSON.stringify({ maxChanges: n }),
      }).then((r) => r.json());
      if (r.ok) {
        await sendTelegram(`✅ Autopilot done: fixed *${r.pagesFixed}* page(s), *${r.totalFixes}* total fixes.`, {
          chatId,
          parseMode: 'Markdown',
        });
      } else {
        await sendTelegram(`⚠️ Autopilot error: ${String(r.error || 'unknown').slice(0, 200)}`, { chatId });
      }
    } else if (cmd.startsWith('/')) {
      await sendTelegram(`Unknown command \`${cmd}\`. Try /help`, { chatId, parseMode: 'Markdown' });
    } else if (cmd) {
      // free text — acknowledge so the user knows the bot is alive
      await sendTelegram(`Got it. Send /help to see what I can do.`, { chatId });
    }
  } catch (e: unknown) {
    await sendTelegram(`⚠️ Error: ${String(e).slice(0, 200)}`, { chatId });
  }

  if (cb) await answerCallback(cb.id);
  return res.status(200).json({ ok: true });
}
