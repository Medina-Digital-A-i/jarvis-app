// api/_lib/telegram.ts
// Shared helper for talking to the JARVIS Telegram bot. Files under api/_lib/
// start with "_" so Vercel does NOT turn them into routes.
//
// Agents call sendTelegram(...) to push a message to the owner's chat.
// Env: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHAT_ID (owner's chat id).

const API = 'https://api.telegram.org';

export interface TgButton {
  text: string;
  data: string; // callback_data, routed back to the webhook on tap
}

interface SendOpts {
  chatId?: string;
  parseMode?: 'Markdown' | 'HTML';
  buttons?: TgButton[][]; // rows of inline buttons
}

// Send a message. Returns false (never throws) if the bot isn't configured or
// the API call fails — notifications must never break the agent that called them.
export async function sendTelegram(text: string, opts: SendOpts = {}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.buttons) {
    body.reply_markup = {
      inline_keyboard: opts.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))),
    };
  }
  try {
    const r = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Acknowledge a button tap so Telegram stops showing the loading spinner.
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${API}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || '' }),
    });
  } catch {
    /* non-critical */
  }
}
