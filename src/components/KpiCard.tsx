type Tone = 'cyan' | 'amber' | 'gold';

type Props = {
  label: string;
  value: React.ReactNode;
  delta: string;
  deltaDir?: 'up' | 'down';
  spark: number[]; // 0–100 values
  tone?: Tone;
};

const TONE_GRAD: Record<Tone, string> = {
  cyan: 'linear-gradient(90deg, transparent, #00D9FF, transparent)',
  amber: 'linear-gradient(90deg, transparent, #FFA500, transparent)',
  gold: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
};
const TONE_BAR: Record<Tone, string> = {
  cyan: 'linear-gradient(180deg, #00D9FF, rgba(0,217,255,0.2))',
  amber: 'linear-gradient(180deg, #FFA500, rgba(255,165,0,0.2))',
  gold: 'linear-gradient(180deg, #FFD700, rgba(255,215,0,0.2))',
};

export default function KpiCard({ label, value, delta, deltaDir = 'up', spark, tone = 'cyan' }: Props) {
  return (
    <div
      className="relative px-5 pt-5 pb-4 border border-line rounded-md overflow-hidden transition-all hover:border-line-strong"
      style={{ background: 'linear-gradient(180deg, rgba(0,217,255,0.04), rgba(10,14,39,0.6))' }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60" style={{ background: TONE_GRAD[tone] }} />
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-dim mb-2">{label}</div>
      <div
        className="font-mono text-[32px] font-bold text-ink tracking-[0.04em] leading-tight"
        style={{ textShadow: tone === 'amber' ? '0 0 10px rgba(255,165,0,0.45)' : '0 0 10px rgba(0,217,255,0.25)' }}
      >
        {value}
      </div>
      <div className={`mt-2.5 flex items-center gap-1.5 font-mono text-[11px] ${deltaDir === 'up' ? 'text-success' : 'text-alert'}`}>
        <span>{deltaDir === 'up' ? '▲' : '▼'}</span>
        <span>{delta}</span>
      </div>
      <div className="mt-3 h-7 flex items-end gap-[3px]">
        {spark.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm opacity-60"
            style={{ height: `${h}%`, background: TONE_BAR[tone] }}
          />
        ))}
      </div>
    </div>
  );
}
