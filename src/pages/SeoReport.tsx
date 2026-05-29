import { useState, useEffect, useCallback } from 'react';
import PageHead from '@/components/PageHead';

interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  isQuickWin: boolean;
}

interface GscData {
  rows: GscRow[];
  isDemo?: boolean;
  demoMessage?: string;
  startDate: string;
  endDate: string;
}

const TARGET_KEYWORDS = [
  'commercial cleaning albany ny',
  'janitorial services albany ny',
  'cleaning services albany ny',
  'post construction cleaning albany ny',
  'office cleaning albany ny',
  'make ready cleaning albany ny',
  'student housing cleaning albany ny',
  'commercial cleaning saratoga springs ny',
  'building cleanout albany ny',
  'albany commercial cleaning',
];

const SEO_TASKS = [
  { id: 1, label: 'Add "make ready cleaning albany ny" to homepage H2 and meta description' },
  { id: 2, label: 'Create dedicated /student-housing-cleaning page with target keyword in title tag' },
  { id: 3, label: 'Build /building-cleanout-albany-ny service page (currently missing)' },
  { id: 4, label: 'Add schema markup (LocalBusiness + Service) to all service pages' },
  { id: 5, label: 'Get 5 more Google reviews to boost local pack ranking' },
  { id: 6, label: 'Add internal links from homepage to /post-construction-cleaning' },
  { id: 7, label: 'Optimize meta titles: include city + service (max 60 chars)' },
  { id: 8, label: 'Submit updated sitemap to Google Search Console' },
  { id: 9, label: 'Add FAQ section to /commercial-cleaning page (targets featured snippets)' },
  { id: 10, label: 'Build citation links on Angi, HomeAdvisor, and Yelp Albany listings' },
];

const posColor = (pos: number) =>
  pos <= 3 ? 'text-emerald-400'
    : pos <= 10 ? 'text-sky-400'
    : pos <= 20 ? 'text-amber-400'
    : 'text-red-400';

function findKeyword(rows: GscRow[], keyword: string): GscRow | null {
  return rows.find((r) => r.key.toLowerCase().includes(keyword.toLowerCase())) ?? null;
}

function positionDelta(prev: number | null, curr: number | null): number | null {
  if (prev === null || curr === null) return null;
  return Math.round((prev - curr) * 10) / 10; // positive = improved (lower position number)
}

export default function SeoReport() {
  const [data28, setData28] = useState<GscData | null>(null);
  const [data7, setData7] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('seo-tasks-checked');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res28, res7] = await Promise.all([
        fetch('/api/gsc-data?type=queries&days=28'),
        fetch('/api/gsc-data?type=queries&days=7'),
      ]);
      const [json28, json7] = await Promise.all([res28.json(), res7.json()]);
      if (json28.error) throw new Error(json28.error);
      if (json7.error) throw new Error(json7.error);
      setData28(json28);
      setData7(json7);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleTask = (id: number) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem('seo-tasks-checked', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // --- Derived data ---
  const rows28 = data28?.rows ?? [];
  const rows7 = data7?.rows ?? [];

  // Coverage Score: how many target keywords have pos ≤ 10 in 28-day data
  const coverageResults = TARGET_KEYWORDS.map((kw) => {
    const row = findKeyword(rows28, kw);
    return { keyword: kw, row, onPage1: row ? row.position <= 10 : false };
  });
  const coverageScore = coverageResults.filter((r) => r.onPage1).length;

  // Quick Wins: pos 8–20, 5+ impressions (28-day)
  const quickWins = rows28
    .filter((r) => r.position >= 8 && r.position <= 20 && r.impressions >= 5)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  // Top Movers: compare 7d vs 28d position (positive delta = improved)
  const movers = rows7
    .map((r7) => {
      const r28 = rows28.find((r) => r.key === r7.key);
      const delta = r28 ? positionDelta(r28.position, r7.position) : null;
      return { ...r7, prevPosition: r28?.position ?? null, delta };
    })
    .filter((r) => r.delta !== null && r.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 8);

  // Keyword Opportunities: high impressions, 0 clicks
  const opportunities = rows28
    .filter((r) => r.clicks === 0 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  const isDemo = data28?.isDemo;
  const completedTasks = SEO_TASKS.filter((t) => checkedTasks.has(t.id)).length;

  return (
    <div>
      <PageHead title="SEO Weekly Report" meta="Rankings · opportunities · coverage · action items" />

      {/* Header controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="text-sm text-white/40">
          {data28 && <span>28-day: {data28.startDate} → {data28.endDate}</span>}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-medium transition"
        >
          {loading ? 'Loading…' : 'Refresh Data'}
        </button>
      </div>

      {isDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-300 mb-5">
          ⚡ <strong>Demo Mode</strong> — {data28?.demoMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-300 mb-5">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/40 text-sm">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Fetching 7-day and 28-day GSC data…
        </div>
      )}

      {data28 && !loading && (
        <div className="space-y-8">

          {/* === Coverage Score === */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
                Coverage Score
              </h2>
              <span className={`text-2xl font-bold ${
                coverageScore >= 8 ? 'text-emerald-400'
                  : coverageScore >= 5 ? 'text-sky-400'
                  : 'text-amber-400'
              }`}>
                {coverageScore} / {TARGET_KEYWORDS.length} on Page 1
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/10 mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  coverageScore >= 8 ? 'bg-emerald-500' : coverageScore >= 5 ? 'bg-sky-500' : 'bg-amber-500'
                }`}
                style={{ width: `${(coverageScore / TARGET_KEYWORDS.length) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {coverageResults.map(({ keyword, row, onPage1 }) => (
                <div
                  key={keyword}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
                    onPage1
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={onPage1 ? 'text-emerald-400' : 'text-white/20'}>
                      {onPage1 ? '✓' : '○'}
                    </span>
                    <span className="text-white/70 truncate max-w-[220px]">{keyword}</span>
                  </div>
                  {row ? (
                    <span className={`font-mono text-xs font-bold ml-2 shrink-0 ${posColor(row.position)}`}>
                      #{row.position}
                    </span>
                  ) : (
                    <span className="text-white/20 text-xs ml-2 shrink-0">not ranked</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* === Quick Wins === */}
          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">
              ⚡ Quick Wins — Positions 8–20 with 5+ Impressions
            </h2>
            {quickWins.length === 0 ? (
              <p className="text-white/30 text-sm">No quick wins found in current data.</p>
            ) : (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Keyword</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Pos.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Impr.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickWins.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 bg-amber-500/5 hover:bg-amber-500/10 transition">
                        <td className="px-4 py-2.5 text-white/80">
                          <span className="text-amber-400 mr-2">⚡</span>{row.key}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${posColor(row.position)}`}>
                          #{row.position}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sky-400">{row.impressions}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{row.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-white/30 mt-2">
              These keywords are close to page 1 — improving title tags and internal links can move them up fast.
            </p>
          </section>

          {/* === Top Movers === */}
          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">
              ↑ Top Movers — 7-Day vs 28-Day
            </h2>
            {movers.length === 0 ? (
              <p className="text-white/30 text-sm">Not enough data to calculate movers yet.</p>
            ) : (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Keyword</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">7-day Pos.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">28-day Pos.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movers.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                        <td className="px-4 py-2.5 text-white/80">{row.key}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${posColor(row.position)}`}>
                          #{row.position}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-white/40">
                          {row.prevPosition !== null ? `#${row.prevPosition}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-bold">
                          +{row.delta} positions
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* === Keyword Opportunities === */}
          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">
              ◎ Keyword Opportunities — Impressions with Zero Clicks
            </h2>
            <p className="text-xs text-white/40 mb-3">
              These keywords are showing up in search but nobody clicks — usually a title tag / meta description problem.
            </p>
            {opportunities.length === 0 ? (
              <p className="text-white/30 text-sm">No zero-click opportunities found.</p>
            ) : (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Keyword</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Impressions</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Pos.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide">Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                        <td className="px-4 py-2.5 text-white/80">{row.key}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sky-400">{row.impressions}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${posColor(row.position)}`}>
                          #{row.position}
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-400 text-xs">
                          Rewrite title/meta
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* === Action Checklist === */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
                ✓ Action Checklist
              </h2>
              <span className="text-xs text-white/40">
                {completedTasks} / {SEO_TASKS.length} completed
              </span>
            </div>
            {/* Checklist progress */}
            <div className="h-1.5 rounded-full bg-white/10 mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(completedTasks / SEO_TASKS.length) * 100}%` }}
              />
            </div>
            <div className="space-y-2">
              {SEO_TASKS.map((task) => {
                const done = checkedTasks.has(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition ${
                      done
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-white/30 line-through'
                        : 'border-white/8 bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:border-indigo-500/30'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs ${
                      done ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/20'
                    }`}>
                      {done ? '✓' : ''}
                    </span>
                    <span className="text-sm">{task.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/20 mt-3">
              Checkboxes persist in your browser.
            </p>
          </section>

        </div>
      )}
    </div>
  );
}
