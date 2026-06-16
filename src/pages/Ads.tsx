import { useState } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface AdGroup { name: string; keywords: string[]; headlines: string[]; descriptions: string[] }
interface Campaign { campaignName: string; dailyBudget: number; monthlyEstimate: number; location: string; adGroups: AdGroup[]; rationale: string; projectedClicks: string }

export default function Ads() {
  const site = useActiveSiteConfig();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);
  const [copied, setCopied] = useState(false);

  const build = async () => {
    if (!site) return;
    let token = tok || getActionToken();
    if (!token) { setNeedTok(true); return; }
    setActionToken(token);
    setBusy(true); setMsg(null); setCampaign(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token }, body: JSON.stringify({ action: 'ads', site: site.id }) });
      const d = await r.json();
      if (r.status === 401) { setNeedTok(true); setMsg('Action token rejected.'); }
      else if (d.ok && d.campaign) setCampaign(d.campaign);
      else setMsg(d.error || 'Could not build a campaign.');
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const copyText = () => {
    if (!campaign) return;
    const t = [
      `Campaign: ${campaign.campaignName}`,
      `Daily budget: $${campaign.dailyBudget}  (~$${campaign.monthlyEstimate}/mo)`,
      `Location: ${campaign.location}`,
      '',
      ...campaign.adGroups.flatMap((g) => [
        `Ad group: ${g.name}`,
        `  Keywords: ${g.keywords.join(', ')}`,
        `  Headlines: ${g.headlines.join(' | ')}`,
        `  Descriptions: ${g.descriptions.join(' | ')}`,
        '',
      ]),
    ].join('\n');
    navigator.clipboard?.writeText(t);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <PageHead title="Ads" meta={site ? `${site.label} · AI-built paid campaigns` : 'paid campaigns'}
        actions={<button className="btn btn-primary" onClick={build} disabled={busy}>{busy ? 'Building…' : '✨ Build a campaign'}</button>} />

      {needTok && (
        <div className="mb-4 panel p-4 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token</span>
          <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" className="px-3 py-1.5 rounded-md bg-bg-deep border border-line text-ink text-[13px] flex-1 min-w-[160px]" />
          <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); build(); }}>Save & build</button>
        </div>
      )}
      {msg && <div className="mb-4 text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{msg}</div>}

      {!campaign && !busy && (
        <Panel><div className="p-8 text-center">
          <div className="text-[40px] mb-2">📣</div>
          <div className="text-ink-soft text-[14px] mb-1">JARVIS designs a launch-ready Google Ads campaign from your real Search Console data.</div>
          <div className="text-ink-dim text-[12px]">Keywords, ad copy, budget, projection — then you approve the spend. Hit “Build a campaign.”</div>
        </div></Panel>
      )}

      {campaign && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Daily budget" value={`$${campaign.dailyBudget}`} tone="text-emerald-400" />
            <Stat label="~Monthly" value={`$${campaign.monthlyEstimate}`} />
            <Stat label="Ad groups" value={String(campaign.adGroups.length)} />
            <Stat label="Est. clicks/mo" value={campaign.projectedClicks || '—'} small />
          </div>

          <Panel className="mb-5">
            <PanelHead title={`📣 ${campaign.campaignName}`} meta={campaign.location} right={
              <div className="flex gap-2">
                <button className="btn" onClick={copyText}>{copied ? 'Copied ✓' : '📋 Copy'}</button>
                <button className="btn btn-primary" onClick={() => setMsg('🔒 To auto-launch + manage spend, connect Google Ads (see the card below). For now, “Copy” the campaign and paste it into Google Ads to go live today.')}>🚀 Approve &amp; launch</button>
              </div>
            } />
            <div className="p-4 space-y-3">
              <div className="text-[12.5px] text-ink-soft">{campaign.rationale}</div>
              {campaign.adGroups.map((g, i) => (
                <div key={i} className="rounded-lg border border-line bg-white/[0.02] p-4">
                  <div className="font-mono text-[12px] text-blue font-bold mb-2">{g.name}</div>
                  <div className="text-[11px] text-ink-dim uppercase tracking-wide mb-1">Keywords</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">{g.keywords.map((k, j) => <span key={j} className="text-[11px] font-mono px-2 py-0.5 rounded border border-line text-ink-soft">{k}</span>)}</div>
                  <div className="text-[11px] text-ink-dim uppercase tracking-wide mb-1">Headlines</div>
                  <div className="space-y-1 mb-3">{g.headlines.map((h, j) => <div key={j} className="text-[12.5px] text-white">• {h}</div>)}</div>
                  <div className="text-[11px] text-ink-dim uppercase tracking-wide mb-1">Descriptions</div>
                  <div className="space-y-1">{g.descriptions.map((dd, j) => <div key={j} className="text-[12px] text-ink-soft">• {dd}</div>)}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="🔌 Connect Google Ads to auto-launch + manage" />
            <div className="p-4 text-[12.5px] text-ink-soft space-y-2">
              <p>Right now JARVIS <span className="text-white">designs</span> the campaign; launching it spends real money, so that stays your one-tap approval. To enable in-app launch + budget control + live ROAS:</p>
              <ol className="list-decimal ml-5 space-y-1 text-ink-soft">
                <li>Create/confirm a <span className="text-white">Google Ads account</span> with billing set up.</li>
                <li>In Google Ads → API Center, request a <span className="text-white">developer token</span>.</li>
                <li>Authorize JARVIS (OAuth) and grab your <span className="text-white">customer ID</span>.</li>
              </ol>
              <p className="text-ink-dim">Tell me when you’re ready and I’ll wire the launch + analytics. Until then, “Copy” drops the whole campaign into Google Ads in one paste.</p>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-dim">{label}</div>
      <div className={`font-mono ${small ? 'text-[16px]' : 'text-[26px]'} font-bold leading-tight mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}
