// Tiny global store for active site selection.
// Replaces with Zustand / Context once the app needs more state.

import { useEffect, useState } from 'react';

const KEY = 'jarvis.activeSite';

let listeners = new Set<(id: string) => void>();
let value = (typeof window !== 'undefined' && localStorage.getItem(KEY)) || 'tps';

export function setActiveSite(id: string) {
  value = id;
  if (typeof window !== 'undefined') localStorage.setItem(KEY, id);
  listeners.forEach((l) => l(id));
}

export function useActiveSite() {
  const [v, setV] = useState(value);
  useEffect(() => {
    const fn = (id: string) => setV(id);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return [v, setActiveSite] as const;
}
