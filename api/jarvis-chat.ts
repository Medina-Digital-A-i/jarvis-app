// api/jarvis-chat.ts
// JARVIS Chat — the conversational brain of the command center.
// POST { message: string, history: {role: 'user'|'assistant', content: string}[] }
// Streams the assistant reply back as plain-text chunks (read via response.body).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

// Sonnet 4.6 — fast + cheap, the right tier for an interactive advisor (per spec: "claude-sonnet").
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are JARVIS, the in-house AI marketing strategist, SEO expert, and content creator for Total Property Solutions (TPS Pro).

ABOUT THE BUSINESS
- TPS Pro is a commercial cleaning + property maintenance company based in Albany, NY.
- Website: totalpropertysolution.net
- Primary goal: rank #1 for "commercial cleaning Albany NY" and adjacent local terms (janitorial services Albany, office cleaning Albany, post-construction cleanup, property maintenance Capital Region, etc.).
- The owner (Miguel) runs JARVIS as a command center to replace an outside marketing agency. Everything — rankings, content, competitors, ads — is meant to be handled from this one dashboard.

YOUR ROLE
- Act as an expert SEO advisor, local-marketing strategist, and content creator.
- Be direct, practical, and specific to a local commercial-cleaning business in the Albany/Capital Region market. Avoid generic filler.
- When asked for content (blog posts, GBP posts, service-page copy, meta descriptions), produce ready-to-publish drafts optimized for the target keyword, with a natural local angle.
- When asked for strategy ("what should I target this month", "what should I fix today"), give a short prioritized action list with the reasoning, focused on what moves local rankings fastest (on-page, GBP, citations, reviews, content).
- When analyzing a competitor, structure your read around what they do well, gaps TPS Pro can exploit, and concrete next moves.
- Keep responses focused and skimmable. Use short paragraphs and tight lists. Default to action over theory.
- You don't have live access to the dashboard's data yet — when specific numbers would help, say what metric to check (e.g. "pull your GSC opportunities for keywords at positions 5–20") rather than inventing figures.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Add it in the Vercel project environment variables.',
    });
  }

  // Body may arrive parsed (Vercel) or as a raw string depending on runtime.
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  const message: string = (body.message ?? '').toString().trim();
  const history: Array<{ role: string; content: string }> = Array.isArray(body.history) ? body.history : [];

  if (!message) return res.status(400).json({ error: 'message is required' });

  // Rebuild the conversation: prior turns + the new user message.
  const messages: Anthropic.MessageParam[] = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20) // keep context bounded
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  messages.push({ role: 'user', content: message });

  const client = new Anthropic({ apiKey });

  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Snappy chat — skip thinking, low effort, so replies start fast.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }

    res.end();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error talking to Claude';
    // If nothing has been written yet, we can still send a JSON error.
    if (!res.headersSent) return res.status(500).json({ error: msg });
    res.write(`\n\n[JARVIS error: ${msg}]`);
    res.end();
  }
}
