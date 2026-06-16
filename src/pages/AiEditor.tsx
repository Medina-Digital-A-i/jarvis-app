import { useState, useEffect, useCallback } from 'react';
import PageHead from '@/components/PageHead';
import { Panel, PanelHead } from '@/components/Panel';
import { useActiveSiteConfig, getActionToken, setActionToken } from '@/lib/store';

interface Preview { path: string; summary: string; newHtml: string; before: number; after: number }

const EXAMPLES = [
  'Add a banner at the top of the homepage: "Winter Special — 15% off first cleaning"',
  'Change the phone number on the contact page to (518) 555-0199',
  'Make the homepage headline more premium and confident',
  'Add a FAQ section to the services page with 3 common questions',
];

export default function AiEditor() {
  const site = useActiveSiteConfig();
  const [pages, setPages] = useState<string[]>([]);
  const [path, setPath] = useState('index.html');
  const [instruction, setInstruction] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'ship' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tok, setTok] = useState(getActionToken());
  const [needTok, setNeedTok] = useState(false);

  const canEdit = site?.platform === 'github';

  const api = useCallback(async (payload: any) => {
    const token = getActionToken();
    return fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
      body: JSON.stringify({ ...payload, site: site?.id }),
    });
  }, [site]);

  // Load the page list when the site changes (github sites + token).
  useEffect(() => {
    setPreview(null); setMsg(null); setPages([]); setPath('index.html');
    if (!site || !canEdit || !getActionToken()) return;
    api({ action: 'pages' }).then((r) => r.json()).then((d) => { if (Array.isArray(d.pages)) setPages(d.pages); }).catch(() => {});
  }, [site, canEdit, api]);

  const doPreview = async () => {
    if (!instruction.trim()) { setMsg('Describe the change you want.'); return; }
    if (!getActionToken()) { setNeedTok(true); return; }
    setBusy('preview'); setMsg(null); setPreview(null);
    try {
      const r = await api({ action: 'edit', path, instruction: instruction.trim() });
      const d = await r.json();
      if (r.status === 401) { setNeedTok(true); setMsg('Action token rejected.'); }
      else if (d.auditOnly) setMsg(d.message);
      else if (d.error || d.ok === false) setMsg(d.error || 'Could not generate the edit.');
      else if (!d.changed) setMsg('Claude returned the page unchanged — try a clearer instruction.');
      else setPreview(d);
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(null); }
  };

  const ship = async () => {
    if (!preview) return;
    setBusy('ship'); setMsg(null);
    try {
      const r = await api({ action: 'commit', path: preview.path, content: preview.newHtml, summary: preview.summary });
      const d = await r.json();
      if (d.ok) { setMsg(`✅ Shipped to /${preview.path}. Live in ~1–2 min (GitHub Pages rebuild).`); setPreview(null); setInstruction(''); }
      else setMsg(d.error || 'Ship failed.');
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(null); }
  };

  const field = 'w-full px-3 py-2 rounded-md bg-bg-deep border border-line text-ink text-[13px] focus:border-blue/50 outline-none';

  return (
    <>
      <PageHead title="AI Editor" meta={site ? `${site.label} · plain-English changes → live site` : 'edit your site by typing'} />

      {!canEdit ? (
        <Panel><div className="p-6 text-center text-ink-soft text-[13px]">
          {site ? `${site.label} is a ${site.platform} site — AI editing needs a GitHub-hosted site (it commits code). Switch to a GitHub site, or edit ${site.label} in its builder.` : 'Select a site.'}
        </div></Panel>
      ) : (
        <>
          {needTok && (
            <div className="mb-4 panel p-4 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">Action token needed</span>
              <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" className={`${field} flex-1 min-w-[160px]`} />
              <button className="btn btn-primary" onClick={() => { setActionToken(tok); setNeedTok(false); }}>Save token</button>
            </div>
          )}

          <Panel className="mb-5">
            <PanelHead title="✨ Describe your change" />
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim mb-1 block">Page</label>
                  <select className={field} value={path} onChange={(e) => setPath(e.target.value)}>
                    {(pages.length ? pages : ['index.html']).map((p) => <option key={p} value={p}>{p === 'index.html' ? 'Homepage (index.html)' : p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim mb-1 block">What should change?</label>
                  <textarea className={`${field} h-[76px] resize-none`} value={instruction} onChange={(e) => setInstruction(e.target.value)}
                    placeholder='e.g. Add a banner: "Winter Special — 15% off first cleaning"' />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setInstruction(ex)} className="text-[11px] text-ink-dim hover:text-blue border border-line rounded-md px-2 py-1 transition-colors text-left">
                    {ex.length > 46 ? ex.slice(0, 46) + '…' : ex}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={doPreview} disabled={busy !== null}>{busy === 'preview' ? 'Thinking…' : '👀 Preview change'}</button>
              </div>
              {msg && <div className="text-[13px] text-ink bg-blue/10 border border-blue/30 rounded-lg px-4 py-2.5">{msg}</div>}
            </div>
          </Panel>

          {preview && (
            <Panel>
              <PanelHead title="Preview — review before shipping" meta={`${preview.before.toLocaleString()} → ${preview.after.toLocaleString()} chars`} right={
                <div className="flex gap-2">
                  <button className="btn" onClick={() => setPreview(null)} disabled={busy !== null}>Discard</button>
                  <button className="btn btn-primary" onClick={ship} disabled={busy !== null}>{busy === 'ship' ? 'Shipping…' : '🚀 Ship it'}</button>
                </div>
              } />
              <div className="p-4">
                <div className="text-[12px] text-ink-soft mb-2">“{preview.summary}” on <span className="font-mono text-ink">/{preview.path}</span></div>
                <iframe title="preview" srcDoc={preview.newHtml} sandbox="" className="w-full h-[460px] bg-white rounded-lg border border-line" />
                <div className="text-[11px] text-ink-dim mt-2">This is a live render of the edited page. Scripts are disabled in the preview; they run normally once shipped.</div>
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
