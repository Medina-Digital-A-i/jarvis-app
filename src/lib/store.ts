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
