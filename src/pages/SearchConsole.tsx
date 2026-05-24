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
  site: string;
  startDate: string;
  endDate: string;
  dimension: string;
  totalRows: number;
  quickWins: number;
  rows: GscRow[];
}

type SortKey = 'clicks' | 'impressions' | 'ctr' | 'position';
type Tab = 'queries' | 'pages';

const posColor = (pos: number) =>
  pos <= 3 ? 'text-emerald-400'
    : pos <= 10 ? 'text-sky-400'
    : pos <= 20 ? 'text-amber-400'
    : 'text-red-400';

const ctrColor = (ctr: number) =>
  ctr >= 5 ? 'text-emerald-400' : ctr >= 2 ? 'text-sky-400' : 'text-white/40';

export default function SearchConsole() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [data, setData] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('queries');
  const [days, setDays] = useState('90');
  const [sort, setSort] = useState<SortKey>('clicks');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    fetch('/api/gsc-data?type=status')
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gsc-data?type=${tab}&days=${days}`);
      const json = await res.json();
      if (json.error === 'not_connected') {
        setConnected(false);
        return;
      }
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab, days]);

  useEffect(() => {
    if (connected) fetchData();
  }, [connected, fetchData]);

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setSortDir(key === 'position' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sort !== key) return <span className="text-white/20 ml-1">↕</span>;
    return <span className="text-indigo-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const rows = (data?.rows ?? [])
    .filter((r) => !quickWinsOnly || r.isQuickWin)
    .filter((r) => !search || r.key.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return (a[sort] - b[sort]) * mul;
    });

  const totals = rows.reduce(
    (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
    { clicks: 0, impressions: 0 }
  );

  // --- Not connected / needs GSC permission ---
  if (connected === false) {
    return (
      <div>
        <PageHead title="Search Console" meta="Live rankings · queries · clicks · impressions" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-6">🔑</div>
          <h2 className="text-xl font-bold text-white mb-3">One Permission Needed</h2>
          <p className="text-white/50 text-sm max-w-md mb-8">
            JARVIS uses a dedicated service account to read your Search Console data automatically — no passwords, no token expiry, always on. You just need to grant it access once.
          </p>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 max-w-lg text-left w-full">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Two-minute setup</h3>
            {[
              {
                step: '1',
                title: 'Open Search Console',
                desc: 'Go to search.google.com/search-console and select totalpropertysolution.net',
                link: 'https://search.google.com/search-console',
                linkText: 'Open Search Console →',
              },
              {
                step: '2',
                title: 'Settings → Users and permissions',
                desc: 'Click Settings in the left sidebar, then "Users and permissions"',
              },
              {
                step: '3',
                title: 'Add user',
                desc: 'Click "Add user" and enter this exact email:',
                code: 'jarvis-gsc-reader@jarvis-tpspro-2026.iam.gserviceaccount.com',
              },
              {
                step: '4',
                title: 'Set permission to Full, click Add',
                desc: 'That\'s it — come back here and refresh. Data loads instantly.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 py-3 border-t border-white/5 first:border-0">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white/90">{item.title}</div>
                  <div className="text-xs text-white/40 mt-0.5">{item.desc}</div>
                  {item.code && (
                    <div className="mt-2 bg-black/30 border border-white/10 rounded px-3 py-1.5 font-mono text-xs text-emerald-400 select-all break-all">
                      {item.code}
                    </div>
                  )}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noreferrer"
                      className="inline-block mt-2 text-xs text-indigo-400 hover:underline">
                      {item.linkText}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setConnected(null); fetchData(); }}
            className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
          >
            I added it — load data
          </button>
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (connected === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Search Console" meta="Live rankings · queries · clicks · impressions" />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {(['queries', 'pages'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition capitalize ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-indigo-500"
          >
            <option value="7">Last 7 days</option>
            <option value="28">Last 28 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-medium transition"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <span className="text-xs text-white/30">
            Service account · auto-refresh
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-300 mb-5">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Pulling data from Google…
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Clicks', value: totals.clicks.toLocaleString(), color: 'text-emerald-400' },
              { label: 'Total Impressions', value: totals.impressions.toLocaleString(), color: 'text-sky-400' },
              { label: `${tab === 'queries' ? 'Keywords' : 'Pages'}`, value: data.totalRows, color: 'text-white' },
              { label: 'Quick Win Keywords', value: data.quickWins, color: 'text-amber-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1">{kpi.label}</div>
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder={`Search ${tab}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 min-w-[200px]"
            />
            <button
              onClick={() => setQuickWinsOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                quickWinsOnly
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              ⚡ Quick Wins Only
            </button>
            <span className="text-xs text-white/30 self-center">
              {data.startDate} → {data.endDate}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.03]">
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">
                      {tab === 'queries' ? 'Keyword' : 'Page'}
                    </th>
                    {(['clicks', 'impressions', 'ctr', 'position'] as SortKey[]).map((k) => (
                      <th
                        key={k}
                        onClick={() => handleSort(k)}
                        className="text-right px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium cursor-pointer hover:text-white/70 transition whitespace-nowrap"
                      >
                        {k === 'ctr' ? 'CTR' : k === 'position' ? 'Pos.' : k.charAt(0).toUpperCase() + k.slice(1)}
                        {sortIcon(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-white/5 hover:bg-white/[0.03] transition ${
                        row.isQuickWin ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-white/80 max-w-xs">
                        <div className="flex items-center gap-2">
                          {row.isQuickWin && (
                            <span title="Quick win — close to page 1" className="text-amber-400 text-xs">⚡</span>
                          )}
                          <span className="truncate">{row.key}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{row.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sky-400">{row.impressions.toLocaleString()}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${ctrColor(row.ctr)}`}>{row.ctr}%</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${posColor(row.position)}`}>
                        {row.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="py-12 text-center text-white/30 text-sm">No results match your filter.</div>
              )}
            </div>
          </div>

          {/* Position legend */}
          <div className="flex gap-4 mt-3 text-xs text-white/30">
            <span><span className="text-emerald-400 font-bold">■</span> Pos 1–3 (Top)</span>
            <span><span className="text-sky-400 font-bold">■</span> Pos 4–10 (Page 1)</span>
            <span><span className="text-amber-400 font-bold">■</span> Pos 11–20 (Page 2)</span>
            <span><span className="text-red-400 font-bold">■</span> Pos 20+ </span>
            <span><span className="text-amber-400 font-bold">⚡</span> Quick win (push to page 1)</span>
          </div>
        </>
      )}
    </div>
  );
}
