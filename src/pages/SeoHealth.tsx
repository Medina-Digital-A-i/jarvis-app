import { useState, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

type IssueType = 'error' | 'warning' | 'ok';

interface Issue {
  type: IssueType;
  label: string;
  detail: string;
}

interface AuditResult {
  url: string;
  status: number;
  score: number;
  title: string | null;
  metaDesc: string | null;
  h1s: string[];
  h2s: string[];
  hasSchema: boolean;
  isHttps: boolean;
  imgsTotal: number;
  imgsNoAlt: number;
  wordCount: number;
  issues: Issue[];
}

const TARGET_URLS = [
  'https://totalpropertysolution.net',
  'https://totalpropertysolution.net/janitorial-services.html',
  'https://totalpropertysolution.net/commercial-cleaning-albany-ny.html',
];

const scoreColor = (s: number) =>
  s >= 80 ? 'text-emerald-400' : s >= 55 ? 'text-amber-400' : 'text-red-400';

const scoreBg = (s: number) =>
  s >= 80
    ? 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30'
    : s >= 55
    ? 'from-amber-500/20 to-amber-500/5 border-amber-500/30'
    : 'from-red-500/20 to-red-500/5 border-red-500/30';

const scoreLabel = (s: number) => (s >= 80 ? 'Strong' : s >= 55 ? 'Needs Work' : 'Critical');

const issueBg = (t: IssueType) =>
  t === 'ok'
    ? 'border-white/5 bg-white/[0.02]'
    : t === 'warning'
    ? 'border-amber-500/20 bg-amber-500/5'
    : 'border-red-500/20 bg-red-500/5';

const IssueIcon = ({ type }: { type: IssueType }) => {
  if (type === 'ok') return <span className="text-emerald-400 text-sm font-bold">✓</span>;
  if (type === 'warning') return <span className="text-amber-400 text-sm font-bold">!</span>;
  return <span className="text-red-400 text-sm font-bold">✗</span>;
};

export default function SeoHealth() {
  const [results, setResults] = useState<(AuditResult | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(true);
  const [audited, setAudited] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [filter, setFilter] = useState<'all' | IssueType>('all');

  const runAudits = async () => {
    setLoading(true);
    setAudited(null);
    const fetched = await Promise.all(
      TARGET_URLS.map(async (url) => {
        try {
          const res = await fetch(`/api/seo-audit?url=${encodeURIComponent(url)}`);
          const data = await res.json();
          if (data.error) return null;
          return data as AuditResult;
        } catch {
          return null;
        }
      })
    );
    setResults(fetched);
    setAudited(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EDT');
    setLoading(false);
  };

  useEffect(() => { runAudits(); }, []);

  const active = results[activeIdx];
  const errors = active?.issues.filter((i) => i.type === 'error').length ?? 0;
  const warnings = active?.issues.filter((i) => i.type === 'warning').length ?? 0;
  const oks = active?.issues.filter((i) => i.type === 'ok').length ?? 0;
  const filtered = active?.issues.filter((i) => filter === 'all' || i.type === filter) ?? [];

  const avgScore = results.filter(Boolean).length > 0
    ? Math.round(results.filter(Boolean).reduce((a, r) => a + (r?.score ?? 0), 0) / results.filter(Boolean).length)
    : null;

  return (
    <>
      <PageHead
        title="SEO Health"
        meta="Technical SEO audit · on-page issues · score"
        actions={
          <button className="btn" onClick={runAudits} disabled={loading}>
            {loading ? '…' : '⟳ Re-Audit'}
          </button>
        }
      />

      {audited && (
        <div className="text-xs text-white/30 font-mono mb-4">
          Last audited: {audited}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          Running live SEO audit on {TARGET_URLS.length} pages…
        </div>
      )}

      {!loading && (
        <>
          {/* Overall score + page selector */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Avg Health Score</div>
              <div className={`text-3xl font-black ${avgScore ? scoreColor(avgScore) : 'text-white/30'}`}>
                {avgScore ?? '—'}
                <span className="text-base font-normal text-white/20">/100</span>
              </div>
            </div>
            {TARGET_URLS.map((url, i) => {
              const r = results[i];
              return (
                <button
                  key={url}
                  onClick={() => { setActiveIdx(i); setFilter('all'); }}
                  className={`text-left rounded-xl border px-4 py-4 transition ${
                    activeIdx === i
                      ? 'border-amber/40 bg-amber/[0.06]'
                      : 'border-white/8 bg-white/[0.03] hover:border-white/15'
                  }`}
                >
                  <div className="text-xs text-white/40 uppercase tracking-wide mb-1 truncate">
                    {url.replace('https://totalpropertysolution.net', '').replace('/', '/') || '/'}
                  </div>
                  <div className={`text-2xl font-bold ${r ? scoreColor(r.score) : 'text-white/20'}`}>
                    {r ? r.score : '—'}
                    <span className="text-xs font-normal text-white/20">/100</span>
                  </div>
                  {r && (
                    <div className="text-xs text-white/30 mt-1">{scoreLabel(r.score)}</div>
                  )}
                </button>
              );
            })}
          </div>

          {active && (
            <>
              {/* Score detail bar */}
              <div className={`rounded-xl border bg-gradient-to-br p-5 mb-5 ${scoreBg(active.score)}`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className={`text-4xl font-black ${scoreColor(active.score)}`}>
                      {active.score}
                      <span className="text-xl font-semibold text-white/25">/100</span>
                    </div>
                    <div className="text-white/40 text-xs mt-1 font-mono">{active.url}</div>
                  </div>
                  <div className="flex gap-5 text-center">
                    <div>
                      <div className="text-xl font-bold text-red-400">{errors}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wide">Errors</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-amber-400">{warnings}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wide">Warnings</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-emerald-400">{oks}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wide">Passed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Word Count', value: active.wordCount.toLocaleString() },
                  { label: 'HTTP Status', value: active.status },
                  { label: 'Images (no-alt)', value: `${active.imgsTotal} (${active.imgsNoAlt})` },
                  { label: 'H1 / H2', value: `${active.h1s.length} / ${active.h2s.length}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs text-white/40 uppercase tracking-wide mb-1">{item.label}</div>
                    <div className="text-white font-semibold text-sm">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Issues list */}
              <Panel>
                <PanelHead
                  title="Issues & Checks"
                  meta={`${active.issues.length} checks run`}
                  right={
                    <div className="flex gap-1">
                      {(['all', 'error', 'warning', 'ok'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`text-xs px-2.5 py-1 rounded-full transition capitalize ${
                            filter === f
                              ? 'bg-amber/20 text-amber border-amber/30 border'
                              : 'bg-white/5 text-white/40 hover:text-white/70'
                          }`}
                        >
                          {f === 'all' ? `All (${active.issues.length})` : f === 'error' ? `✗ ${errors}` : f === 'warning' ? `! ${warnings}` : `✓ ${oks}`}
                        </button>
                      ))}
                    </div>
                  }
                />
                <div className="p-4 space-y-2">
                  {filtered.map((issue, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-4 py-3 flex gap-3 items-start ${issueBg(issue.type)}`}
                    >
                      <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center shrink-0 mt-0.5 bg-white/5">
                        <IssueIcon type={issue.type} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/90">{issue.label}</div>
                        {issue.detail && (
                          <div className="text-xs text-white/40 mt-0.5">{issue.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </>
  );
}
