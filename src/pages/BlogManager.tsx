import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

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
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/blog-index.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setIndex(d))
      .catch(() => setIndex({ lastUpdated: '', nextScheduledTopic: '', posts: [] }))
      .finally(() => setLoading(false));
  }, []);

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
        meta="Published posts · target keywords · content calendar"
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate('/chat', {
                state: {
                  prefill: index?.nextScheduledTopic
                    ? `Write me a new blog post for TPS Pro on: "${index.nextScheduledTopic}". Make it locally optimized for Albany, NY and ready to publish.`
                    : 'Write me a new, locally-optimized blog post for TPS Pro about commercial cleaning in Albany, NY. Suggest a target keyword first, then write the full post.',
                },
              })
            }
          >
            ✦ New Post
          </button>
        }
      />

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
