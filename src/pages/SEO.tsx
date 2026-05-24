import { useState, useRef } from 'react';
import PageHead from '@/components/PageHead';

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
  h3s: string[];
  canonical: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDesc: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  hasSchema: boolean;
  hasViewport: boolean;
  isHttps: boolean;
  imgsTotal: number;
  imgsNoAlt: number;
  wordCount: number;
  loadMs: number | null;
  issues: Issue[];
}

const QUICK_URLS = [
  'https://totalpropertysolution.net',
  'https://totalpropertysolution.net/janitorial-services.html',
  'https://totalpropertysolution.net/commercial-cleaning-albany-ny.html',
];

const scoreColor = (s: number) =>
  s >= 80 ? 'text-emerald-400' : s >= 55 ? 'text-amber-400' : 'text-red-400';

const scoreBg = (s: number) =>
  s >= 80 ? 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30'
    : s >= 55 ? 'from-amber-500/20 to-amber-500/5 border-amber-500/30'
    : 'from-red-500/20 to-red-500/5 border-red-500/30';

const scoreLabel = (s: number) =>
  s >= 80 ? 'Strong' : s >= 55 ? 'Needs Work' : 'Critical';

const IssueIcon = ({ type }: { type: IssueType }) => {
  if (type === 'ok') return <span className="text-emerald-400 text-sm font-bold">✓</span>;
  if (type === 'warning') return <span className="text-amber-400 text-sm font-bold">!</span>;
  return <span className="text-red-400 text-sm font-bold">✗</span>;
};

const issueBg = (t: IssueType) =>
  t === 'ok' ? 'border-white/5 bg-white/[0.02]'
    : t === 'warning' ? 'border-amber-500/20 bg-amber-500/5'
    : 'border-red-500/20 bg-red-500/5';

export default function SEO() {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | IssueType>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const runAudit = async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setFilter('all');
    try {
      const res = await fetch(`/api/seo-audit?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAudit(inputUrl);
  };

  const errors = result?.issues.filter((i) => i.type === 'error').length ?? 0;
  const warnings = result?.issues.filter((i) => i.type === 'warning').length ?? 0;
  const oks = result?.issues.filter((i) => i.type === 'ok').length ?? 0;

  const filtered = result?.issues.filter((i) => filter === 'all' || i.type === filter) ?? [];

  return (
    <div>
      <PageHead
        title="SEO Auditor"
        meta="On-page SEO scanner · score · fix recommendations"
      />

      {/* URL Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://totalpropertysolution.net"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 focus:bg-white/8 transition"
        />
        <button
          type="submit"
          disabled={loading || !inputUrl.trim()}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
        >
          {loading ? 'Scanning…' : 'Audit'}
        </button>
      </form>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 mb-8">
        {QUICK_URLS.map((u) => (
          <button
            key={u}
            onClick={() => { setInputUrl(u); runAudit(u); }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition"
          >
            {u.replace('https://', '')}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Fetching and analyzing page…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Score row */}
          <div className={`rounded-xl border bg-gradient-to-br p-6 ${scoreBg(result.score)}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className={`text-5xl font-black ${scoreColor(result.score)}`}>
                  {result.score}
                  <span className="text-2xl font-semibold text-white/30">/100</span>
                </div>
                <div className="text-white/50 text-sm mt-1">{scoreLabel(result.score)} — {result.url}</div>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-red-400">{errors}</div>
                  <div className="text-xs text-white/40 uppercase tracking-wide">Errors</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-400">{warnings}</div>
                  <div className="text-xs text-white/40 uppercase tracking-wide">Warnings</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{oks}</div>
                  <div className="text-xs text-white/40 uppercase tracking-wide">Passed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Page snapshot */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Word Count', value: result.wordCount.toLocaleString() },
              { label: 'HTTP Status', value: result.status },
              { label: 'Images', value: `${result.imgsTotal} (${result.imgsNoAlt} no-alt)` },
              { label: 'H1 / H2 / H3', value: `${result.h1s.length} / ${result.h2s.length} / ${result.h3s.length}` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1">{item.label}</div>
                <div className="text-white font-semibold text-sm">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Extracted data */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Extracted Data</h3>
            {[
              { label: 'Title', value: result.title },
              { label: 'Meta Description', value: result.metaDesc },
              { label: 'Canonical', value: result.canonical },
              { label: 'OG Title', value: result.ogTitle },
              { label: 'OG Description', value: result.ogDesc },
              { label: 'OG Image', value: result.ogImage },
              { label: 'Twitter Card', value: result.twitterCard },
              { label: 'Robots', value: result.robotsMeta },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-2 text-sm border-t border-white/5 pt-3">
                <span className="text-white/40">{label}</span>
                <span className={value ? 'text-white/80 break-all' : 'text-white/20 italic'}>
                  {value ?? 'Not found'}
                </span>
              </div>
            ))}
          </div>

          {/* Issue list */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-white">Issues &amp; Checks</h3>
              <div className="flex gap-1">
                {(['all', 'error', 'warning', 'ok'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1 rounded-full transition capitalize ${
                      filter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-white/40 hover:text-white/70'
                    }`}
                  >
                    {f === 'all' ? `All (${result.issues.length})` : f === 'error' ? `Errors (${errors})` : f === 'warning' ? `Warnings (${warnings})` : `OK (${oks})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
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
          </div>

          {/* H2 list */}
          {result.h2s.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">H2 Tags</h3>
              <ul className="space-y-1">
                {result.h2s.map((h, i) => (
                  <li key={i} className="text-sm text-white/70 flex gap-2">
                    <span className="text-white/20">H2</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-white/30 text-sm max-w-sm">
            Enter any URL above to run a full on-page SEO audit — title, meta tags, H1/H2s, images, Open Graph, schema markup, and a score.
          </p>
        </div>
      )}
    </div>
  );
}
