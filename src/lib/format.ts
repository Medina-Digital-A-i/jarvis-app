// Shared formatting helpers. Everything user-facing is Eastern Time.

const ET = 'America/New_York';

// Absolute timestamp in Eastern, e.g. "Jun 15, 6:42 PM ET".
export function fmtET(ts: string | number | null | undefined): string {
  if (ts == null || ts === '') return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleString('en-US', {
      timeZone: ET,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET'
  );
}

// "now" in Eastern with seconds, e.g. "Jun 15, 6:42:07 PM ET".
export function nowET(): string {
  return new Date().toLocaleString('en-US', { timeZone: ET }) + ' ET';
}

// Compact relative time, e.g. "4s ago", "3m ago", "2h 10m ago", "5d ago".
export function relAgo(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
