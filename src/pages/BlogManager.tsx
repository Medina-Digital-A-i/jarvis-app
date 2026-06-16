import { useState, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface BlogPost {
  title: string;
  slug: string;
  publishedDate: string;
  targetKeyword: string;
  wordCount: number;
}

interface BlogIndex {
  lastUpdated: string;
  nextScheduledTopic: string;
  posts: BlogPost[];
}

export default function BlogManager() {
  const [index, setIndex] = useState<BlogIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const site = useActiveSiteConfig();
  const [topic, setTopic] = useState('');
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState<'write' | 'publish' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);

  useEffect(() => {
    fetch('/blog-index.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setIndex(d))
      .catch(() => setIndex({ lastUpdated: '', nextScheduledTopic: '', posts: [] }))
      .finally(() => setLoading(false));
  }, []);

  const callBlog = async (publish: boolean) => {
    if (!site) return;
    let token = tok || getActionToken();
    if (!token) { setNeedTok(true); return; }
    setActionToken(token);
    setBusy(publish ? 'publish' : 'write'); setMsg(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token }, body: JSON.stringify({ action: 'blog', site: site.id, topic: topic.trim() || undefined, publish }) });
      const d = await r.json();
      if (r.status === 401) { setNeedTok(true); setMsg('Action token rejected.'); }
      else if (d.published) { setMsg(`✅ Published: ${d.post?.title}. Live in ~1–2 min. ${d.url || ''}`); setDraft(null); }
      else if (d.ok && d.post) { setDraft({ ...d.post, _keyword: d.keyword }); setMsg(d.note || null); }
      else setMsg(d.error || 'Could not write the post.');
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(null); }
  };

  const published = (index?.posts ?? []).filter((p) => p.publishedDate);
  const sorted = [...published].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  const lastPublished = sorted[0]?.publishedDate ?? null;
  const avgWords = published.length > 0
    ? Math.round(published.reduce((a, p) => a + p.wordCount, 0) / published.length)
    : 0;

  return (
    <>
      <PageHead
        title="Blog Manager"
        meta="Published posts · AI content engine"
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="topic (or blank = auto-pick a gap)"
              className="px-3 py-2 rounded-md bg-bg-deep border border-line text-ink text-[13px] w-[220px] max-w-[55vw]" />
            <button className="btn btn-primary" onClick={() => callBlog(false)} disabled={busy !== null}>{busy === 'write' ? 'Writing…' : '✨ Write a post'}</button>
          </div>
        }
      />

      {needTok && (
        <div className="mb-4 panel p-3 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); callBlog(false); }}>Save</button>
        </div>
      )}
      {msg && <div className="mb-4 text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{msg}</div>}

      {draft && (
        <Panel className="mb-5">
          <PanelHead title="Draft — review before publishing" meta={draft._keyword ? `target: ${draft._keyword}` : undefined} right={
            <div className="flex gap-2">
              <button className="btn" onClick={() => setDraft(null)} disabled={busy !== null}>Discard</button>
              <button className="btn btn-primary" onClick={() => callBlog(true)} disabled={busy !== null}>{busy === 'publish' ? 'Publishing…' : '🚀 Publish'}</button>
            </div>
          } />
          <div className="p-4">
            <div className="text-white font-semibold text-[16px] mb-1">{draft.title}</div>
            <div className="text-ink-dim text-[12px] mb-3 font-mono">{draft.metaDescription}</div>
            <div className="rounded-lg border border-line bg-white p-4 max-h-[460px] overflow-y-auto" style={{ color: '#1a2230' }} dangerouslySetInnerHTML={{ __html: draft.content }} />
          </div>
        </Panel>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Published Posts</div>
          <div className="text-2xl font-bold text-white">{published.length}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Last Published</div>
          <div className="text-lg font-bold text-emerald-400">{lastPublished ?? '—'}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Avg Word Count</div>
          <div className="text-2xl font-bold text-sky-400">{avgWords > 0 ? avgWords.toLocaleString() : '—'}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Next Topic</div>
          <div className="text-sm font-semibold text-amber-400 truncate">
            {index?.nextScheduledTopic || '—'}
          </div>
        </div>
      </div>

      <Panel>
        <PanelHead
          title="Blog Posts"
          meta={`${published.length} posts indexed · updated ${index?.lastUpdated ?? '…'}`}
        />

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            Loading blog index…
          </div>
        )}

        {!loading && published.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="text-4xl mb-4">✍️</div>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              No blog posts indexed yet. The SEO agent will populate this file once content is published.
            </p>
            <p className="text-white/25 text-xs mt-3 font-mono">
              Reads from: /public/blog-index.json
            </p>
          </div>
        )}

        {published.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Target Keyword</th>
                  <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Published</th>
                  <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Words</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Slug</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((post, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.025] transition">
                    <td className="px-4 py-3 text-white/85 font-medium max-w-xs">
                      <span className="truncate block">{post.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-sky-400/80 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded">
                        {post.targetKeyword}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/40 text-xs">{post.publishedDate}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/40 text-xs">
                      {post.wordCount > 0 ? post.wordCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/25 font-mono text-xs truncate max-w-[150px]">
                      /{post.slug}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
