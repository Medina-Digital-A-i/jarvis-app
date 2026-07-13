// Tiny global store — active site, sidebar state, cached site-health score.
// Intentionally dependency-free; swap for Zustand / Context if state grows.

import { useEffect, useState } from 'react';

/* ---------------- generic localStorage-backed signal ---------------- */

function makeSignal<T>(key: string, initial: T) {
  const listeners = new Set<(v: T) => void>();
  let value: T = initial;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      try { value = JSON.parse(raw) as T; } catch { /* keep initial */ }
    }
  }

  const set = (next: T) => {
    value = next;
    if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(next));
    listeners.forEach((l) => l(next));
  };

  const use = () => {
    const [v, setV] = useState(value);
    useEffect(() => {
      const fn = (nv: T) => setV(nv);
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }, []);
    return [v, set] as const;
  };

  return { get: () => value, set, use };
}

/* ---------------- active site ---------------- */

const site = makeSignal<string>('jarvis.activeSite', 'tps');
export const setActiveSite = site.set;
export const useActiveSite = site.use;

/* ---------------- shared action token ---------------- */

const ACTION_TOKEN_KEY = 'jarvis_action_token';
export function getActionToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem(ACTION_TOKEN_KEY) || '' : '';
}
export function setActionToken(v: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(ACTION_TOKEN_KEY, v);
}

/** Auto-bootstrap: fetch token from /api/init on first visit.
 *  No login required — personal tool.
 */
export async function bootstrapActionToken(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(ACTION_TOKEN_KEY)) return; // already set
  try {
    const r = await fetch('/api/init');
    if (!r.ok) return;
    const j = await r.json();
    if (j?.token) setActionToken(j.token);
  } catch {
    // silently ignore — manual paste still works
  }
}

/* ---------------- multi-site registry (from /api/sites) ---------------- */

export interface SiteConfig {
  id: string;
  label: string;
  domain: string;
  baseUrl: string;
  platform: 'github' | 'wix' | 'other';
  gscProperty: string | null;
  githubRepo: string | null;
  brand: string;
  brandShort: string;
  phone: string;
  region: string;
  active: boolean;
}

let _sitesCache: SiteConfig[] | null = null;
const sitesListeners = new Set<(s: SiteConfig[]) => void>();

export async function loadSites(force = false): Promise<SiteConfig[]> {
  if (_sitesCache && !force) return _sitesCache;
  try {
    const r = await fetch('/api/sites', { cache: 'no-store' });
    const j = await r.json();
    _sitesCache = Array.isArray(j.sites) ? j.sites : [];
  } catch {
    _sitesCache = [];
  }
  const result = _sitesCache ?? [];
  sitesListeners.forEach((l) => l(result));
  return result;
}

export function useSites() {
  const [sites, setSites] = useState<SiteConfig[]>(_sitesCache ?? []);
  const [loading, setLoading] = useState(_sitesCache == null);
  useEffect(() => {
    const fn = (s: SiteConfig[]) => setSites(s);
    sitesListeners.add(fn);
    if (_sitesCache == null) loadSites().finally(() => setLoading(false));
    else setLoading(false);
    return () => { sitesListeners.delete(fn); };
  }, []);
  return { sites, loading, reload: () => loadSites(true) };
}

export function useActiveSiteConfig(): SiteConfig | null {
  const { sites } = useSites();
  const [activeId] = useActiveSite();
  return sites.find((s) => s.id === activeId) ?? sites[0] ?? null;
}

/* ---------------- sidebar collapse ---------------- */

const sidebar = makeSignal<boolean>('jarvis.sidebarCollapsed', false);
export const useSidebarCollapsed = sidebar.use;

/* ---------------- cached site-health score ----------------
 * Written by the SEO Health page after an audit; read by the TopBar so the
 * health badge stays in sync without re-auditing on every route change. */

export type SiteHealth = { score: number; at: string } | null;
const health = makeSignal<SiteHealth>('jarvis.siteHealth', null);
export const setSiteHealth = (score: number, at: string) => health.set({ score, at });
export const useSiteHealth = health.use;
