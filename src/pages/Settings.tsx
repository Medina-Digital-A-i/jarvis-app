import { useState } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import AddSiteModal from '@/components/AddSiteModal';
import { useSites, getActionToken, type SiteConfig } from '@/lib/store';

const platformBadge = (p: SiteConfig['platform']) =>
  p === 'github'
    ? { label: 'GITHUB · AUTO-FIX', cls: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' }
    : { label: p === 'wix' ? 'WIX · AUDIT ONLY' : 'OTHER · AUDIT ONLY', cls: 'text-amber border-amber/30 bg-amber/10' };

export default function Settings() {
  const { sites, loading, reload } = useSites();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const removeSite = async (id: string) => {
    const token = getActionToken();
    if (!token) { alert('No action token saved. Add a site first to store your token.'); return; }
    if (!confirm(`Remove this site from JARVIS?`)) return;
    setBusy(id);
    try {
      await fetch(`/api/sites?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-jarvis-token': token },
      });
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead
        title="Settings"
        meta="Sites · capabilities · integrations"
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add Site</button>}
      />

      <Panel className="mb-5">
        <PanelHead title="Sites JARVIS manages" meta={`${sites.length} site${sites.length === 1 ? '' : 's'}`} />
        <div className="p-4 space-y-2">
          {loading && sites.length === 0 && <div className="text-ink-dim text-sm font-mono py-4 text-center">loading…</div>}
          {sites.map((s) => {
            const b = platformBadge(s.platform);
            return (
              <div key={s.id} className="rounded-lg border border-line bg-white/[0.02] px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-mono text-[13px] text-white font-bold">{s.label}</div>
                  <div className="font-mono text-[11px] text-ink-dim truncate">{s.domain}</div>
                </div>
                <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${s.gscProperty ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-ink-dim border-white/10 bg-white/5'}`}>
                  {s.gscProperty ? 'GSC ✓' : 'NO GSC'}
                </span>
                {s.id !== 'tps' && (
                  <button
                    onClick={() => removeSite(s.id)}
                    disabled={busy === s.id}
                    className="text-[11px] font-mono px-2.5 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    {busy === s.id ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="mb-5">
        <PanelHead title="What each site can do" />
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
          <Cap icon="🔍" title="Audit" body="On-page SEO score + issues. Works for every site." />
          <Cap icon="📈" title="Rank tracking" body="Live keyword rankings. Needs a Search Console property connected." />
          <Cap icon="🛠️" title="Auto-fix" body="Agents commit SEO fixes automatically. GitHub-hosted sites only." />
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Integrations" meta="connection status" />
        <div className="p-4 space-y-2 text-[12px]">
          <Row label="Search Console" ok detail="Connected · live rankings flowing" />
          <Row label="GitHub" ok detail="Connected · agents can commit fixes" />
          <Row label="Action token" ok={!!getActionToken()} detail={getActionToken() ? 'Saved in this browser' : 'Not set — needed to add/remove sites'} />
          <Row label="Telegram bot" ok detail="@Jarvis_183bot · notifications" />
          <Row label="Google Business Profile" ok={false} detail="Not connected — GBP posting disabled until creds added" />
        </div>
      </Panel>

      {adding && <AddSiteModal onClose={() => setAdding(false)} onAdded={() => { reload(); setAdding(false); }} />}
    </>
  );
}

function Cap({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2 mb-1"><span>{icon}</span><span className="font-mono text-[12px] text-white font-bold">{title}</span></div>
      <div className="text-ink-soft leading-snug">{body}</div>
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-white/[0.02] px-4 py-2.5">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <span className="font-mono text-[12px] text-white w-44 shrink-0">{label}</span>
      <span className="text-ink-soft">{detail}</span>
    </div>
  );
}
