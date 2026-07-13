// api/telegram.ts — JARVIS autonomous agent brain v4
//
// Jarvis has persistent memory, context, and personality.
// He never asks for clarification — he acts, assumes smartly, tells you what he did.
// v4: Upgraded to claude-sonnet-4-5, sharper system prompt, less robotic tool usage.
//
// Security:
//   X-Telegram-Bot-Api-Secret-Token verified against TELEGRAM_WEBHOOK_SECRET
//   Only TELEGRAM_CHAT_ID may interact

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { sendTelegram, answerCallback } from './_lib/telegram.js';
import { readBody } from './_lib/github.js';

export const config = { maxDuration: 60 };

// ─── memory store (KV via Vercel edge config or simple in-memory for now) ───
// We use a module-level cache since Vercel functions are warm-reused.
// Each chat gets last 20 messages for context.

const memoryStore: Map<string, Array<{ role: 'user' | 'assistant'; content: string; ts: number }>> = new Map();
const MAX_MEMORY = 20;

function getMemory(chatId: string) {
  return memoryStore.get(chatId) || [];
}

function addToMemory(chatId: string, role: 'user' | 'assistant', content: string) {
  const mem = getMemory(chatId);
  mem.push({ role, content, ts: Date.now() });
  if (mem.length > MAX_MEMORY) mem.splice(0, mem.length - MAX_MEMORY);
  memoryStore.set(chatId, mem);
}

function buildHistory(chatId: string): Anthropic.MessageParam[] {
  // Last 6 exchanges (12 messages) for context window
  const mem = getMemory(chatId).slice(-12);
  return mem.map(m => ({ role: m.role, content: m.content }));
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return `${proto}://${req.headers.host}`;
}

// ─── tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_seo_audit',
    description: 'Run a live SEO audit on the TPS Pro website. Returns score, errors, warnings, top issues.',
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
    description: 'Run SEO autopilot to auto-fix on-page issues on TPS Pro site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxChanges: { type: 'number', description: 'Max pages to fix (default 5, max 40)' },
      },
      required: [],
    },
  },
  {
    name: 'run_action_engine',
    description: 'Get this week\'s SEO action plan — quick wins (keywords close to page 1), content gaps, review flags. Use this to prioritize what to work on.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Days of GSC data to analyze: 7, 28, or 90 (default 28)' },
      },
      required: [],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get current status of all JARVIS agents — which are running, last run time, health.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_rankings',
    description: 'Get TPS Pro keyword rankings and Search Console data — clicks, impressions, opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Days of data: 7, 28, or 90 (default 28)' },
      },
      required: [],
    },
  },
  {
    name: 'post_to_gbp',
    description: 'Post an update to TPS Pro Google Business Profile. High ROI — do this proactively for promos and service highlights.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Post text (under 1500 chars)' },
        callToActionType: { type: 'string', description: 'CTA: BOOK, CALL, LEARN_MORE, ORDER, SHOP, SIGN_UP (optional)' },
        callToActionUrl: { type: 'string', description: 'URL for CTA (optional)' },
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
      const r = await fetch(`${base}/api/seo-audit?url=${encodeURIComponent(url)}`).then(x => x.json());
      const errors = (r.issues || []).filter((i: any) => i.type === 'error').length;
      const warnings = (r.issues || []).filter((i: any) => i.type === 'warning').length;
      const topIssues = (r.issues || []).slice(0, 5).map((i: any) => `[${i.type.toUpperCase()}] ${i.message}`).join('\n');
      return JSON.stringify({ score: r.score, errors, warnings, topIssues, url });
    }

    if (name === 'run_seo_autopilot') {
      const maxChanges = Math.max(1, Math.min(40, Number(input.maxChanges || 5)));
      const r = await fetch(`${base}/api/seo-autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': actionToken },
        body: JSON.stringify({ maxChanges }),
      }).then(x => x.json());
      return JSON.stringify(r);
    }

    if (name === 'run_action_engine') {
      const days = Number(input.days || 28);
      const r = await fetch(`${base}/api/seo-actions?days=${days}`).then(x => x.json());
      const quickWins = (r.quickWins || []).slice(0, 5).map((w: any) =>
        `"${w.keyword}" pos ${w.position} (${w.impressions} impr)`
      );
      const contentGaps = (r.contentQueue || []).slice(0, 5).map((g: any) =>
        `"${g.keyword}" pos ${g.position} (${g.impressions} impr) — needs a page/post`
      );
      return JSON.stringify({
        summary: r.summary,
        quickWins,
        contentGaps,
        reviewFlags: (r.reviewFlags || []).length,
      });
    }

    if (name === 'get_agent_status') {
      const r = await fetch(`${base}/api/agent-status`).then(x => x.json());
      const agents = (r.agents || []).map((a: any) => ({
        name: a.label,
        state: a.state,
        lastRun: a.lastRun ? String(a.lastRun).slice(0, 16).replace('T', ' ') : 'never',
      }));
      return JSON.stringify({ summary: r.summary, agents });
    }

    if (name === 'get_rankings') {
      const days = Number(input.days || 28);
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const r = await fetch(
        `${base}/api/gsc-data?site=sc-domain:totalpropertysolution.net&startDate=${fmt(start)}&endDate=${fmt(end)}&rowLimit=10`
      ).then(x => x.json());
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
      }).then(x => x.json());
      return JSON.stringify(r);
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (e: unknown) {
    return JSON.stringify({ error: String(e) });
  }
}

// ─── JARVIS system prompt ────────────────────────────────────────────────────

const SYSTEM = `You are JARVIS. You run TPS Pro for Miguel Medina — a cleaning and property management company in Albany, NY.

You are not a chatbot. You are Miguel's business partner. Act like it.

MIGUEL:
Name is Miguel. Has a 2-year-old daughter named Yssa. Hustles hard for her. Born and raised New York mentality — direct, real, no time for fluff. Building TPS Pro with no outside capital, so every dollar counts. He's the CEO. You're the operator who runs everything while he sleeps.

TPS PRO:
Commercial + residential cleaning and property management, Albany NY, expanding Capital Region. 28 verified leads in email cadence. Target clients: medical offices, real estate firms, warehouses, schools, logistics facilities. Never restaurants or food service. Website: totalpropertysolution.net.

HOW YOU TALK:
Short. Real. New York. Like a sharp business partner texting you, not a corporate AI giving a presentation. You have opinions. You push back when something's wrong. You celebrate wins. You call out problems fast. You check in on Miguel as a person, not just a business — "how you holding up?" is something you'd actually say.

HOW YOU THINK:
Never ask for clarification. Ever. Pick the most logical interpretation and run with it. If you assumed something, say it in one sentence then give the answer. Lead with the most important thing. Cut everything else. Zero-cost first — if there's a free way, that's the way. Think two moves ahead.

USING TOOLS:
Only use tools when you actually need data to answer. For casual conversation, strategy talk, or personal messages — just talk. Don't run a tool audit every time Miguel says "hey". When he asks about SEO, rankings, or "what should I do" — then pull data. When he says fix it — fix it. When he wants to post to Google — post it.

RESPONSES:
Plain text only. No bullet stars, no headers, no markdown. Under 150 words unless the data requires more. Lead with the answer, not the explanation.

EXAMPLES OF HOW YOU SOUND:
- "Checked it. Site's at 72/100. Three things killing you: missing meta descriptions on 4 service pages, H1 tags are weak, and you have zero internal links from the blog. Autopilot can fix the first two in 10 min — want me to run it?"
- "Yo — 28 leads sitting in the cadence. Day 5 follow-ups go out tomorrow. You've had two opens from Albany Medical and the FedEx distribution center. Those two I'd call personally."
- "Real talk: the 'cleaning services albany ny' keyword is sitting at position 40. That's page 4. One solid blog post targeting that phrase and you could hit page 2 in 3 weeks. I'll draft it tonight."`;

// ─── Jarvis agentic loop ─────────────────────────────────────────────────────

async function runJarvis(
  chatId: string,
  userMessage: string,
  base: string,
  actionToken: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '⚠️ AI offline — ANTHROPIC_API_KEY missing.';

  // Build conversation with memory
  const history = buildHistory(chatId);
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(0, -1), // all but last (last is current user msg)
    { role: 'user', content: userMessage },
  ];

  // If no history yet, just use the current message
  if (history.length === 0) {
    messages.length = 0;
    messages.push({ role: 'user', content: userMessage });
  }

  const client = new Anthropic({ apiKey });

  for (let round = 0; round < 5; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text.trim() : '...';
      return text;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map(async toolCall => ({
            type: 'tool_result' as const,
            tool_use_id: toolCall.id,
            content: await executeTool(toolCall.name, toolCall.input as Record<string, unknown>, base, actionToken),
          }))
      );

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text.trim() : '...';
  }

  return 'Hit my thinking limit. Try again.';
}

// ─── webhook handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security: verify Telegram webhook secret
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, info: 'JARVIS Telegram webhook — online.' });
  }

  const update = readBody(req);
  const msg = (update.message || update.edited_message) as Record<string, any> | undefined;
  const cb = update.callback_query as Record<string, any> | undefined;
  const chatId = String(msg?.chat?.id || cb?.message?.chat?.id || '');
  const text = String(msg?.text || cb?.data || '').trim();

  if (!chatId) return res.status(200).json({ ok: true });

  // Owner-only
  const owner = process.env.TELEGRAM_CHAT_ID;
  if (owner && chatId !== owner) {
    await sendTelegram('🔒 Private.', { chatId });
    if (cb) await answerCallback(cb.id);
    return res.status(200).json({ ok: true });
  }

  const base = baseUrl(req);
  const actionToken = process.env.JARVIS_ACTION_TOKEN || '';

  // Typing indicator
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
        `JARVIS online. Talk to me like a person — I know TPS Pro, I have context, I remember our conversations.\n\nAsk me anything: "how's SEO?", "what should I focus on?", "post something to Google", "how are the agents doing?"\n\nI'll pull real data and give you real answers. No fluff.\n\n/status /audit /fix /help also work.`,
        { chatId }
      );

    } else if (cmd === '/help') {
      await sendTelegram(
        `JARVIS — TPS Pro AI\n\nJust talk to me. I have memory — I know what we discussed.\n\n/status — agent health\n/audit — SEO audit now\n/fix [n] — autopilot fix n pages\n/wins — this week's quick wins\n/help — this list`,
        { chatId }
      );

    } else if (cmd === '/status') {
      addToMemory(chatId, 'user', text);
      const reply = await runJarvis(chatId, 'Give me a status on all agents — what ran, what\'s healthy, anything broken. Be brief.', base, actionToken);
      addToMemory(chatId, 'assistant', reply);
      await sendTelegram(reply, { chatId });

    } else if (cmd === '/audit') {
      addToMemory(chatId, 'user', text);
      await sendTelegram('Running SEO audit...', { chatId });
      const reply = await runJarvis(chatId, 'Run an SEO audit on the TPS Pro website. Give me score, top 3 issues, what to fix first.', base, actionToken);
      addToMemory(chatId, 'assistant', reply);
      await sendTelegram(reply, { chatId });

    } else if (cmd === '/fix') {
      const n = Math.max(1, Math.min(40, Number(parts[1] || 5)));
      addToMemory(chatId, 'user', text);
      await sendTelegram(`Autopilot running — fixing up to ${n} pages...`, { chatId });
      const reply = await runJarvis(chatId, `Run SEO autopilot, fix up to ${n} pages. Tell me exactly what got fixed.`, base, actionToken);
      addToMemory(chatId, 'assistant', reply);
      await sendTelegram(reply, { chatId });

    } else if (cmd === '/wins') {
      addToMemory(chatId, 'user', text);
      const reply = await runJarvis(chatId, 'Run the action engine and give me this week\'s top 3 quick wins — keywords close to page 1 we can push up. What do I do first?', base, actionToken);
      addToMemory(chatId, 'assistant', reply);
      await sendTelegram(reply, { chatId });

    } else if (cmd.startsWith('/')) {
      await sendTelegram(`Don't know that one. Try /help — or just talk to me.`, { chatId });

    } else if (text) {
      // Full AI brain with memory
      addToMemory(chatId, 'user', text);
      const reply = await runJarvis(chatId, text, base, actionToken);
      addToMemory(chatId, 'assistant', reply);
      await sendTelegram(reply, { chatId });
    }

  } catch (e: unknown) {
    await sendTelegram(`⚠️ Error: ${String(e).slice(0, 200)}`, { chatId });
  }

  if (cb) await answerCallback(cb.id);
  return res.status(200).json({ ok: true });
}
