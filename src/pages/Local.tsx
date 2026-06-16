import { useState } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface Post { type: string; text: string; cta: string; imageIdea: string }

export default function Local() {
  const site = useActiveSiteConfig();
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = async () => {
    if (!site) return;
    let token = tok || getActionToken();
    if (!token) { setNeedTok(true); return; }
    setActionToken(token);
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token }, body: JSON.stringify({ action: 'gbp', site: site.id }) });
      const d = await r.json();
      if (r.status === 401) { setNeedTok(true); setMsg('Action token rejected.'); }
      else if (d.ok && d.posts) setPosts(d.posts);
      else setMsg(d.error || 'Could not generate posts.');
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const copy = (p: Post, i: number) => { navigator.clipboard?.writeText(p.text); setCopied(i); setTimeout(() => setCopied(null), 1600); };

  return (
    <>
      <PageHead title="Reviews & Local" meta={site ? `${site.label} · Google Business Profile + reviews` : 'local SEO'}
        actions={<button className="btn btn-primary" onClick={generate} disabled={busy}>{busy ? 'Writing…' : '✨ Write GBP posts'}</button>} />

      {needTok && (
        <div className="mb-4 panel p-4 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); generate(); }}>Save & write</button>
        </div>
      )}
      {msg && <div className="mb-4 text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{msg}</div>}

      {/* AI-written GBP posts — usable today, paste into Google Business Profile */}
      <Panel className="mb-5">
        <PanelHead title="📍 Ready-to-post GBP content" meta="paste into Google Business Profile" />
        <div className="p-4 space-y-2">
          {posts.length === 0 && <div className="text-[12.5px] text-ink-dim">Hit “Write GBP posts” — JARVIS drafts a week of local posts (offer, tip, update) you can publish in one paste. Weekly GBP posts are a confirmed local-ranking signal.</div>}
          {posts.map((p, i) => (
            <div key={i} className="rounded-lg border border-line bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-blue/30 bg-blue/10 text-blue uppercase">{p.type}</span>
                <span className="text-[10px] font-mono text-ink-dim">CTA: {p.cta}</span>
                <button className="ml-auto btn text-[11px] py-1" onClick={() => copy(p, i)}>{copied === i ? 'Copied ✓' : '📋 Copy'}</button>
              </div>
              <div className="text-[13px] text-white leading-snug">{p.text}</div>
              <div className="text-[11px] text-ink-dim mt-1.5">📷 {p.imageIdea}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Reviews — needs GBP connection */}
      <Panel className="mb-5">
        <PanelHead title="⭐ Reviews" meta="connect to track + auto-reply" />
        <div className="p-4 space-y-2">
          <div className="rounded-lg border border-amber/25 bg-amber/[0.06] px-4 py-3 text-[12.5px] text-ink-soft">
            Live review tracking + AI auto-reply turn on once Google Business Profile is connected (below). Until then, here's the playbook that moves you to the local #1 spot:
          </div>
          {[
            'Set your most accurate PRIMARY GBP category — it’s the top local-pack ranking factor.',
            'Ask every happy customer for a Google review (text them the link) — steady velocity beats a big one-time burst.',
            'Reply to 100% of reviews, personalized — a 2026 trust/ranking signal.',
            'Post weekly + add fresh photos to keep the profile active (use the AI posts above).',
            'Keep your name/address/phone identical everywhere (site + every listing).',
          ].map((t, i) => (
            <div key={i} className="rounded-lg border border-line bg-white/[0.02] px-4 py-2.5 text-[12.5px] text-ink-soft flex gap-2">
              <span className="text-emerald-400">✓</span>{t}
            </div>
          ))}
        </div>
      </Panel>

      {/* Connect GBP */}
      <Panel>
        <PanelHead title="🔌 Connect Google Business Profile" />
        <div className="p-4 text-[12.5px] text-ink-soft space-y-2">
          <p>To turn on live reviews, auto-reply, and one-tap GBP posting, JARVIS needs access to your Business Profile:</p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>In Google Cloud, enable the <span className="text-white">Business Profile API</span> (and request access — Google approval can take a few days).</li>
            <li>Create an <span className="text-white">OAuth client</span>, then authorize the <span className="font-mono text-ink">business.manage</span> scope (easiest via the OAuth Playground) to get a <span className="text-white">refresh token</span>.</li>
            <li>Grab your <span className="text-white">account ID + location ID</span> from the API.</li>
          </ol>
          <p className="text-ink-dim">Paste those to me and I’ll set them in Vercel — then reviews + auto-reply + weekly posting run autonomously like everything else. I’ll walk you through each step whenever you’re ready.</p>
        </div>
      </Panel>
    </>
  );
}
