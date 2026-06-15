import { useState } from 'react';
import { setActiveSite, getActionToken, setActionToken } from '@/lib/store';

// Add-a-site form modal, shared by the TopBar SiteSwitcher and the Settings page.
export default function AddSiteModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [label, setLabel] = useState('');
  const [domain, setDomain] = useState('');
  const [platform, setPlatform] = useState<'github' | 'wix' | 'other'>('other');
  const [gscProperty, setGscProperty] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [brand, setBrand] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [token, setToken] = useState(getActionToken());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!label.trim() || !domain.trim()) { setError('Name and domain are required.'); return; }
    if (!token.trim()) { setError('Action token required to add a site.'); return; }
    setActionToken(token.trim());
    setSaving(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token.trim() },
        body: JSON.stringify({
          label: label.trim(),
          domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
          platform,
          gscProperty: gscProperty.trim() || undefined,
          githubRepo: githubRepo.trim() || undefined,
          brand: brand.trim() || undefined,
          phone: phone.trim() || undefined,
          region: region.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (res.status === 401) throw new Error('Action token rejected (check JARVIS_ACTION_TOKEN).');
      if (!res.ok || j.error) throw new Error(j.error || `Failed (${res.status})`);
      if (j.site?.id) setActiveSite(j.site.id);
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 rounded-md bg-bg-deep border border-line text-ink text-[13px] focus:border-blue/50 outline-none';
  const lbl = 'font-mono text-[10px] tracking-[0.14em] uppercase text-ink-dim mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto panel p-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
          <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-blue">Add a site</div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className={lbl}>Business name *</label>
            <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pour Decisions" />
          </div>
          <div>
            <label className={lbl}>Domain *</label>
            <input className={field} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="pourdecisionsjuicebar.com" />
          </div>
          <div>
            <label className={lbl}>Platform</label>
            <select className={field} value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
              <option value="github">GitHub-hosted (full auto-fix)</option>
              <option value="wix">Wix (audit + rankings only)</option>
              <option value="other">Other (audit + rankings only)</option>
            </select>
            <p className="text-[11px] text-ink-dim mt-1 leading-snug">
              Auto-fixes need a GitHub repo to commit to. Wix/other sites get audits &amp; rank tracking only.
            </p>
          </div>
          {platform === 'github' && (
            <div>
              <label className={lbl}>GitHub repo</label>
              <input className={field} value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="owner/repo" />
            </div>
          )}
          <div>
            <label className={lbl}>Search Console property <span className="normal-case text-ink-dim/70">(optional)</span></label>
            <input className={field} value={gscProperty} onChange={(e) => setGscProperty(e.target.value)} placeholder="sc-domain:pourdecisionsjuicebar.com" />
            <p className="text-[11px] text-ink-dim mt-1">Needed for live rankings. Leave blank if not verified in GSC yet.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Brand</label>
              <input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Pour Decisions" />
            </div>
            <div>
              <label className={lbl}>Region</label>
              <input className={field} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Albany, NY" />
            </div>
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(518) ..." />
          </div>
          {!getActionToken() && (
            <div>
              <label className={lbl}>Action token</label>
              <input className={field} value={token} onChange={(e) => setToken(e.target.value)} placeholder="JARVIS_ACTION_TOKEN" type="password" />
            </div>
          )}
          {error && <div className="text-[12px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-md px-3 py-2">{error}</div>}
        </div>
        <div className="px-5 py-3.5 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">{saving ? 'Adding…' : 'Add site'}</button>
        </div>
      </div>
    </div>
  );
}
