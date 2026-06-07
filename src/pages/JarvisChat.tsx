import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_ACTIONS = [
  { label: '📈 What are my top keywords?', prompt: 'What are my top keywords right now, and which ones should I prioritize this month?' },
  { label: '✍️ Write a blog post', prompt: 'Write me a blog post about commercial cleaning in Albany, NY — optimized to rank locally.' },
  { label: '🏁 Analyze a competitor', prompt: 'Help me analyze a competitor. Ask me for their website, then walk me through what to look for and how TPS Pro can beat them.' },
  { label: '🛠️ What should I fix today?', prompt: 'What are the top 3 SEO things I should fix today to move my local rankings fastest?' },
];

const GREETING =
  "I'm JARVIS — your in-house SEO strategist and content engine for TPS Pro. Ask me about your rankings, your competitors, what to publish next, or have me draft content. What do you want to tackle?";

export default function JarvisChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const sentPrefill = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || streaming) return;

      const history = messages;
      setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
      setInput('');
      setStreaming(true);
      scrollToBottom();

      try {
        const res = await fetch('/api/jarvis-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history }),
        });

        if (!res.ok || !res.body) {
          let err = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) err = j.error;
          } catch { /* response wasn't JSON */ }
          throw new Error(err);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + chunk };
            return next;
          });
          scrollToBottom();
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Something went wrong';
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
          return next;
        });
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [messages, streaming, scrollToBottom],
  );

  // Auto-send a prompt handed off from the command bar / "New Post" button.
  useEffect(() => {
    const prefill = (location.state as { prefill?: string } | null)?.prefill;
    if (prefill && !sentPrefill.current) {
      sentPrefill.current = true;
      window.history.replaceState({}, ''); // clear so a refresh doesn't re-send
      send(prefill);
    }
  }, [location.state, send]);

  const onSubmit = () => send(input);

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-2 border-b border-line">
        <div className="reactor shrink-0" />
        <div>
          <h1 className="font-mono text-[22px] font-bold text-white tracking-[0.04em]">JARVIS Chat</h1>
          <p className="font-mono text-[10px] text-ink-dim uppercase tracking-[0.14em] mt-0.5">
            AI SEO strategist · content creator · marketing advisor
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-line text-[10px] font-mono text-ink-soft uppercase tracking-wider">
          <span className="led" />
          Online · Sonnet
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => send(qa.prompt)}
            disabled={streaming}
            className="px-3 py-1.5 rounded-full border border-line bg-bg-mid/60 text-[12px] text-ink-soft hover:text-blue hover:border-blue/50 hover:bg-blue/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 pb-4">
        {empty && (
          <div className="flex gap-3 animate-fade-up">
            <Avatar who="jarvis" />
            <Bubble who="jarvis">
              <div className="chat-prose">{GREETING}</div>
            </Bubble>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const waiting = isLast && m.role === 'assistant' && m.content === '' && streaming;
          return (
            <div key={i} className={`flex gap-3 animate-fade-up ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar who={m.role === 'user' ? 'user' : 'jarvis'} />
              <Bubble who={m.role === 'user' ? 'user' : 'jarvis'}>
                {waiting ? (
                  <Typing />
                ) : m.role === 'assistant' ? (
                  <div className="chat-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                ) : (
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.content}</div>
                )}
              </Bubble>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-line pt-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-bg-mid/70 focus-within:border-blue/50 transition-colors px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask JARVIS anything… (Enter to send, Shift+Enter for a new line)"
            className="flex-1 bg-transparent outline-none resize-none text-[14px] text-ink placeholder:text-ink-dim max-h-40 py-1.5"
          />
          <button
            onClick={onSubmit}
            disabled={streaming || !input.trim()}
            className="btn btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? '…' : 'Send ▸'}
          </button>
        </div>
        <p className="text-[10px] text-ink-dim/70 mt-2 px-1 font-mono">
          JARVIS can draft content and advise — verify facts and rankings against your live dashboard data.
        </p>
      </div>
    </div>
  );
}

function Avatar({ who }: { who: 'user' | 'jarvis' }) {
  if (who === 'user') {
    return (
      <div
        className="w-8 h-8 rounded-full grid place-items-center font-mono font-bold text-white text-[12px] shrink-0"
        style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
      >
        M
      </div>
    );
  }
  return <div className="reactor shrink-0" style={{ width: 32, height: 32 }} />;
}

function Bubble({ who, children }: { who: 'user' | 'jarvis'; children: React.ReactNode }) {
  const base = 'max-w-[78%] rounded-2xl px-4 py-3';
  return who === 'user' ? (
    <div className={`${base} bg-blue/15 border border-blue/30 text-ink rounded-tr-sm`}>{children}</div>
  ) : (
    <div className={`${base} bg-bg-mid border border-blue/20 text-ink rounded-tl-sm`}>{children}</div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-blue animate-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

/* Minimal, XSS-safe markdown → HTML. Escapes first, then applies a small subset. */
function renderMarkdown(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Fenced code blocks first (protect their contents from other rules).
  const blocks: string[] = [];
  let text = src.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _lang, code) => {
    blocks.push(`<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return ` ${blocks.length - 1} `;
  });

  text = esc(text);

  // Inline: code, bold, links
  text = text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Block-level: split on blank lines, detect lists / headings / paragraphs
  const out = text
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      if (/^ \d+ $/.test(b)) return b; // code placeholder
      const lines = b.split('\n');
      if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
        return `<ul>${lines.map((l) => `<li>${l.replace(/^[-*]\s+/, '').trim()}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
        return `<ol>${lines.map((l) => `<li>${l.replace(/^\d+\.\s+/, '').trim()}</li>`).join('')}</ol>`;
      }
      const h = b.match(/^(#{1,3})\s+(.*)$/);
      if (h) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
      return `<p>${b.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  // Restore code blocks
  return out.replace(/ (\d+) /g, (_m, i) => blocks[Number(i)] ?? '');
}
