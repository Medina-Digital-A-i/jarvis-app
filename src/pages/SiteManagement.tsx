import { useState, useEffect, useMemo } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

type JobKind = 'blog' | 'gbp' | 'rank' | 'citation' | 'competitor';
type ItemStatus = 'draft_awaiting_approval' | 'published' | 'rejected' | 'report';

interface SiteMgmtItem {
  id: string;
  kind: JobKind;
  status: ItemStatus;
  date: string;
  siteId: string;
  title: string;
  summary: string;
  body: string;
  localPath: string;
  meta?: Record<string, unknown>;
}

interface Store {
  lastUpdated: string;
  items: SiteMgmtItem[];
}

const KIND_META: Record<JobKind, { label: string; ico: string; color: string }> = {
  blog: { label: 'Blog', ico: '✎', color: 'text-blue border-blue/30 bg-blue/10' },
  gbp: { label: 'GBP', ico: '📣', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
  rank: { label: 'Rank', ico: '📈', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' },
  citation: { label: 'Citation', ico: '📍', color: 'text-purple-400 border-purple-400/30 bg-purple-400/10' },
  competitor: { label: 'Competitor', ico: '🏁', color: 'text-red-400 border-red-400/30 bg-red-400/10' },
};

const KINDS: JobKind[] = ['blog', 'gbp', 'rank', 'citation', 'competitor'];

function formatTs(ts: string) {
  try {
    return (
      new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      }) + ' ET'
    );
  } catch {
    return ts;
  }
}

export default function SiteManagement() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobKind | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/site-management.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setStore(d))
      .catch(() => setStore({ lastUpdated: '', items: [] }))
      .finally(() => setLoading(false));
  }, []);

  const items = store?.items ?? [];
  const pending = useMemo(() => items.filter((i) => i.status === 'draft_awaiting_approval'), [items]);
  const published30 = items.filter((i) => i.status === 'published').length;
  const reports30 = items.filter((i) => i.status === 'report').length;
  const feed = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  const Row = ({ item }: { item: SiteMgmtItem }) => {
    const km = KIND_META[item.kind];
    const open = expanded === item.id;
    return (
      <div className="border-b border-white/5 last:border-b-0">
        <button
          onClick={() => setExpanded(open ? null : item.id)}
          className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition"
        >
          <span className="w-5 h-5 grid place-items-center text-sm shrink-0 mt-0.5">{km.ico}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{item.title}</span>
              <span className="font-mono text-xs text-white/30">{formatTs(item.date)}</span>
            </div>
            <div className="text-xs text-white/50 mt-0.5">{item.summary}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${km.color}`}>{km.label}</span>
            {item.status === 'draft_awaiting_approval' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border text-amber-400 border-amber-400/30 bg-amber-400/10">
                AWAITING
              </span>
            )}
            {item.status === 'published' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                LIVE
              </span>
            )}
            <span className="text-white/20 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </button>
        {open && (
          <div className="px-11 pb-5 space-y-3">
            <div className="text-[10px] text-white/30 font-mono">
              id: {item.id} · mirror: 07-Marketing-Web/{item.localPath}
            </div>
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono bg-black/30 border border-white/8 rounded-lg p-4 overflow-x-auto max-h-[420px]">
              {item.body}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHead title="Site Management" meta="Autonomous SEO ops · drafts · reports · approvals" />

      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-4">
            <div className="text-xs text-amber-400/70 uppercase tracking-wide mb-1">Awaiting Approval</div>
            <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Published (30d)</div>
            <div className="text-2xl font-bold text-emerald-400">{published30}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Reports (30d)</div>
            <div className="text-2xl font-bold text-white">{reports30}</div>
          </div>
        </div>
      )}

      {/* Approval queue */}
      <Panel className="mb-6">
        <PanelHead title="Approval Queue" meta={`${pending.length} draft(s) awaiting APPROVE`} />
        {pending.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/40 text-sm">
            Nothing awaiting approval. New blog & GBP drafts land here when a Routine runs.
          </div>
        ) : (
          <>
            <div className="px-5 py-3 text-xs text-white/50 border-b border-white/5 bg-amber-400/[0.03]">
              To publish a blog draft: reply <span className="font-mono text-amber-400">APPROVE</span> in Telegram, or POST{' '}
              <span className="font-mono text-white/70">{'{ id }'}</span> to{' '}
              <span className="font-mono text-white/70">/api/routine/blog-publish</span>.
            </div>
            {pending.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </>
        )}
      </Panel>

      {/* Activity feed */}
      <Panel>
        <PanelHead
          title="Last 30 Days"
          meta={store?.lastUpdated ? `Updated ${store.lastUpdated}` : 'Loading…'}
          right={
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`text-[10px] font-mono px-2 py-1 rounded border ${
                  filter === 'all' ? 'text-white border-blue/40 bg-blue/[0.12]' : 'text-white/40 border-white/10 hover:text-white/70'
                }`}
              >
                ALL
              </button>
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    filter === k ? KIND_META[k].color : 'text-white/40 border-white/10 hover:text-white/70'
                  }`}
                >
                  {KIND_META[k].ico} {KIND_META[k].label}
                </button>
              ))}
            </div>
          }
        />

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        )}

        {!loading && feed.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="text-4xl mb-4">🛰️</div>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              No activity yet. Once the Routines POST to <span className="font-mono">/api/routine/*</span>, their drafts and
              reports show up here.
            </p>
          </div>
        )}

        {!loading && feed.map((item) => <Row key={item.id} item={item} />)}
      </Panel>
    </>
  );
}
