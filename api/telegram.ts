// api/telegram.ts — JARVIS autonomous agent brain
//
// Jarvis is NOT a command menu. He's a full AI business partner for TPS Pro.
// Talk to him like a person. He talks back, runs agents, analyzes data, plans moves.
//
// TOOLS Jarvis can use autonomously:
//   run_seo_audit        → /api/seo-audit
//   run_seo_autopilot    → /api/seo-autopilot (fixes pages)
//   run_action_engine    → /api/seo-actions
//   get_agent_status     → /api/agent-status
//   get_rankings         → /api/gsc-data
//   post_to_gbp          → /api/gbp-post (Google Business Profile post)
//
// Slash shortcuts still work: /status /audit /fix /help
//
// Security:
//   X-Telegram-Bot-Api-Secret-Token verified against TELEGRAM_WEBHOOK_SECRET
//   Only TELEGRAM_CHAT_ID may interact

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { sendTelegram, answerCallback } from './_lib/telegram.js';
import { readBody } from './_lib/github.js';

export const config = { maxDuration: 60 };

// ─── helpers ────────────────────────────────────────────────────────────────

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return `${proto}://${req.headers.host}`;
}

// ─── tool definitions (Claude function-calling) ─────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_seo_audit',
    description: 'Run a live SEO audit on the TPS Pro website. Returns score, errors, warnings, and top issues.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to audit (default: https://totalpropertysolution.net)' },
      },
      required: [],
    },
  },
  {
    name: 'run_seo_autopilot',
    description: 'Run the SEO autopilot to automatically fix on-page SEO issues on the TPS Pro site. Returns pages fixed and total fixes made.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxChanges: { type: 'number', description: 'Max pages to fix (default 5, max 40)' },
      },
      required: [],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get the current status of all JARVIS agents — which are running, last run time, health.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_rankings',
    description: 'Get TPS Pro keyword rankings and Search Console performance data — clicks, impressions, opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Days of data to pull: 7, 28, or 90 (default 28)' },
      },
      required: [],
    },
  },
  {
    name: 'post_to_gbp',
    description: 'Post an update to TPS Pro Google Business Profile. Use for promotions, announcements, or service highlights.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The post text (keep under 1500 chars)' },
        callToActionType: {
          type: 'string',
          description: 'CTA button: BOOK, CALL, LEARN_MORE, ORDER, SHOP, SIGN_UP (optional)',
        },
        callToActionUrl: { type: 'string', description: 'URL for the CTA button (optional)' },
      },
      required: ['text'],
    },
  },
];

// ─── tool executor ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  base: string,
  actionToken: string
): Promise<string> {
  try {
    if (name === 'run_seo_audit') {
      const url = (input.url as string) || 'https://totalpropertysolution.net';
      const r = await fetch(`${base}/api/seo-audit?url=${encodeURIComponent(url)}`).then((x) => x.json());
      const errors = (r.issues || []).filter((i: any) => i.type === 'error').length;
      const warnings = (r.issues || []).filter((i: any) => i.type === 'warning').length;
      const topIssues = (r.issues || [])
        .slice(0, 5)
        .map((i: any) => `• [${i.type.toUpperCase()}] ${i.message}`)
        .join('\n');
      return JSON.stringify({ score: r.score, errors, warnings, topIssues, url });
    }

    if (name === 'run_seo_autopilot') {
      const maxChanges = Math.max(1, Math.min(40, Number(input.maxChanges || 5)));
      const r = await fetch(`${base}/api/seo-autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': actionToken },
        body: JSON.stringify({ maxChanges }),
      }).then((x) => x.json());
      return JSON.stringify(r);
    }

    if (name === 'get_agent_status') {
      const r = await fetch(`${base}/api/agent-status`).then((x) => x.json());
      const summary = r.summary || {};
      const agents = (r.agents || []).map((a: any) => ({
        name: a.label,
        state: a.state,
        lastRun: a.lastRun ? String(a.lastRun).slice(0, 16).replace('T', ' ') : 'never',
      }));
      return JSON.stringify({ summary, agents });
    }

    if (name === 'get_rankings') {
      const days = Number(input.days || 28);
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const r = await fetch(
        `${base}/api/gsc-data?site=sc-domain:totalpropertysolution.net&startDate=${fmt(start)}&endDate=${fmt(end)}&rowLimit=10`
      ).then((x) => x.json());
      return JSON.stringify(r);
    }

    if (name === 'post_to_gbp') {
      const r = await fetch(`${base}/api/gbp-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': actionToken },
        body: JSON.stringify({
          text: input.text,
          callToActionType: input.callToActionType,
          callToActionUrl: input.callToActionUrl,
        }),
      }).then((x) => x.json());
      return JSON.stringify(r);
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (e: unknown) {
    return JSON.stringify({ error: String(e) });
  }
}

// ─── Jarvis AI brain (Claude with tools + agentic loop) ─────────────────────

const SYSTEM = `You are JARVIS — the autonomous AI brain running TPS Pro (Total Property Solutions Pro), a cleaning and property management company in New York owned by Miguel Medina.

YOUR PERSONALITY:
- New York energy. Direct, sharp, real. Never corporate.
- You're a business partner, not an assistant. You think ahead.
- You have opinions. You push back when something's wrong.
- CEO mindset: every response helps Miguel grow or fix something.
- Zero-cost first — Miguel is bootstrapping.
- You check in on Miguel personally, not just business.

WHAT YOU KNOW ABOUT TPS PRO:
- Commercial + residential cleaning, property management
- Based in Albany NY area, looking to expand
- HubSpot CRM portal 245950426
- Website: totalpropertysolution.net
- App: jarvis-app-orpin.vercel.app
- Target clients: medical, real estate, education, retail, warehouses, offices, logistics (NO restaurants)
- Miguel's email: crcp183@gmail.com, phone: +15189487156
- Lead system: 28 verified leads, email cadence running (Day 0/5/12/20)

YOUR TOOLS (use them proactively — don't ask permission):
- run_seo_audit: check SEO health of the website
- run_seo_autopilot: automatically fix SEO issues
- get_agent_status: see what agents are running
- get_rankings: pull keyword data from Google Search Console
- post_to_gbp: post to TPS Pro Google Business Profile

WHEN TO USE TOOLS:
- Miguel asks about SEO, rankings, website health → get_rankings or run_seo_audit
- Something is broken or needs fixing → run_seo_autopilot
- Miguel asks "what's running" or "how are agents doing" → get_agent_status
- Good news / promo opportunity → offer to post_to_gbp
- Use tools FIRST, then respond with real data — not guesses.

RESPONSE STYLE:
- Telegram messages: keep it under 200 words
- Lead with the most important thing
- Use plain text only — no markdown headers or asterisks
- Be specific with numbers and data
- When you run something, tell Miguel what you did and what you found
- If something is broken, say what it is and what you're doing about it`;

async function runJarvis(userMessage: string, base: string, actionToken: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '⚠️ AI brain offline — ANTHROPIC_API_KEY not set.';

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  // Agentic loop: Claude calls tools → we execute → feed results back → repeat until done
  for (let round = 0; round < 5; round++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });

    // If Claude is done, return the text
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text.trim() : '...';
    }

    // Claude wants to use tools
    if (response.stop_reason === 'tool_use') {
      // Add Claude's response to the conversation
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls in parallel
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map(async (toolCall) => ({
            type: 'tool_result' as const,
            tool_use_id: toolCall.id,
            content: await executeTool(toolCall.name, toolCall.input as Record<string, unknown>, base, actionToken),
          }))
      );

      // Feed results back
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason — return whatever text we have
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text.trim() : '...';
  }

  return 'Hit my thinking limit on that one. Try asking again.';
}

// ─── webhook handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Telegram secret header
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

  // Always 200 immediately — Telegram retries if we're slow
  if (!chatId) return res.status(200).json({ ok: true });

  const owner = process.env.TELEGRAM_CHAT_ID;
  if (owner && chatId !== owner) {
    await sendTelegram('🔒 This JARVIS bot is private.', { chatId });
    if (cb) await answerCallback(cb.id);
    return res.status(200).json({ ok: true });
  }

  const base = baseUrl(req);
  const actionToken = process.env.JARVIS_ACTION_TOKEN || '';

  // Send "typing..." so Miguel knows Jarvis is thinking
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch { /* non-fatal */ }

  try {
    const parts = text.split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();

    if (cmd === '/start') {
      await sendTelegram(
        `JARVIS online.\n\nYou can talk to me like a person — ask anything about TPS Pro, SEO, leads, agents, rankings. I'll pull real data and give you real answers.\n\nOr use commands:\n/status — agent activity\n/audit — SEO check\n/fix [n] — auto-fix SEO\n/help — this list`,
        { chatId }
      );

    } else if (cmd === '/help') {
      await sendTelegram(
        `JARVIS — TPS Pro AI\n\nJust talk to me. Ask: "how's SEO looking?" or "what should I focus on this week?" or "post something to Google."\n\nCommands:\n/status — recent agent activity\n/audit — run SEO audit now\n/fix [n] — autopilot fix (default 5 pages)\n/help — this list`,
        { chatId }
      );

    } else if (cmd === '/status') {
      const reply = await runJarvis('Give me a quick status on all the agents — what ran recently, what\'s healthy, anything broken.', base, actionToken);
      await sendTelegram(reply, { chatId });

    } else if (cmd === '/audit') {
      await sendTelegram('Running SEO audit now...', { chatId });
      const reply = await runJarvis('Run an SEO audit on the TPS Pro website and tell me the score, top issues, and what to fix first.', base, actionToken);
      await sendTelegram(reply, { chatId });

    } else if (cmd === '/fix') {
      const n = Math.max(1, Math.min(40, Number(parts[1] || 5)));
      await sendTelegram(`Running autopilot — fixing up to ${n} pages...`, { chatId });
      const reply = await runJarvis(`Run the SEO autopilot and fix up to ${n} pages. Tell me what got fixed.`, base, actionToken);
      await sendTelegram(reply, { chatId });

    } else if (cmd.startsWith('/')) {
      await sendTelegram(`Don't know that one. Try /help — or just talk to me directly.`, { chatId });

    } else if (text) {
      // Full AI brain — natural conversation with tool access
      const reply = await runJarvis(text, base, actionToken);
      await sendTelegram(reply, { chatId });
    }

  } catch (e: unknown) {
    await sendTelegram(`⚠️ Hit an error: ${String(e).slice(0, 200)}`, { chatId });
  }

  if (cb) await answerCallback(cb.id);
  return res.status(200).json({ ok: true });
}
