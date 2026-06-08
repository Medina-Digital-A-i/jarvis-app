import { useState, useEffect } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';

interface Competitor {
  name: string;
  domain: string;
  url: string;
  notes?: string;
}

interface CompetitorData {
  lastUpdated: string;
  targetKeyword: string;
  competitors: Competitor[];
  ourPosition: number | null;
  note?: string;
}

export default function Competitors() {
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/competitor-data.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHead
        title="Competitors"
        meta={`Target: ${data?.targetKeyword ?? 'commercial cleaning albany ny'}`}
      />

      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Target Keyword</div>
            <div className="text-sm font-semibold text-white">{data.targetKeyword}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Our Position</div>
            <div className={`text-2xl font-bold ${
              data.ourPosition === null
                ? 'text-white/30'
                : data.ourPosition <= 3
                ? 'text-emerald-400'
                : data.ourPosition <= 10
                ? 'text-amber-400'
                : 'text-red-400'
            }`}>
              {data.ourPosition ?? '—'}
            </div>
            {data.ourPosition === null && (
              <div className="text-xs text-white/25 mt-1">Awaiting GSC</div>
            )}
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Data As Of</div>
            <div className="text-sm font-semibold text-white/50">{data.lastUpdated}</div>
          </div>
        </div>
      )}

      <Panel className="mb-5">
        <PanelHead
          title="Competitor Rankings"
          meta="Populated by SEO agent · update /public/competitor-data.json"
        />

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            {data.competitors.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-3xl mb-3">🏁</div>
                <p className="text-white/40 text-sm">No competitor data yet. The SEO agent will populate this file.</p>
              </div>
            ) : (
              <div>
                {data.competitors.map((comp, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-4 px-5 py-4 ${
                      i < data.competitors.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm border border-white/10 bg-white/5 text-white/50 flex-shrink-0">
                      {comp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{comp.name}</div>
                      {comp.domain ? (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-white/30 hover:text-white/60 transition font-mono"
                        >
                          {comp.domain}
                        </a>
                      ) : (
                        <span className="text-xs text-white/20 font-mono">domain unconfirmed</span>
                      )}
                      {comp.notes && (
                        <div className="text-xs text-white/40 mt-1 leading-relaxed">{comp.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3 border-t border-white/5 text-xs text-white/25 font-mono">
                  {data.note ?? `Last updated · ${data.lastUpdated}`}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* SMS Alert panel */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4">
        <div className="text-sm font-semibold text-emerald-400 mb-1.5">
          📱 Website Lead Notifications
        </div>
        <div className="text-sm text-white/50">
          SMS alerts active — contacts go to{' '}
          <span className="font-mono text-white/70">(518) 948-7156</span>
        </div>
        <div className="text-xs text-white/25 mt-2">
          Form submissions and contact requests trigger an immediate SMS notification.
        </div>
      </div>
    </>
  );
}
