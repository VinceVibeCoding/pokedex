// Single-series index line (base 100) with a dashed baseline at 100. Colored by
// direction like Sparkline; the aria-label carries the numbers for screen readers.

import type { IndexPoint } from "@/serving/indexes";

const W = 560;
const H = 140;
const PAD = 8;

export function IndexChart({ points, label }: { points: IndexPoint[]; label: string }) {
  if (points.length < 2) {
    return <div className="flex h-[140px] items-center justify-center text-sm text-ink-3">Not enough data yet</div>;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 100);
  const max = Math.max(...values, 100);
  const span = max - min || 1;
  const sx = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const sy = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${sx(points.length - 1)},${H - PAD} L${sx(0)},${H - PAD} Z`;
  const last = values[values.length - 1];
  const color = last >= values[0] ? "var(--good)" : "var(--critical)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[140px] w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${values[0].toFixed(1)} to ${last.toFixed(1)} over ${points.length} days`}
    >
      <line x1={PAD} x2={W - PAD} y1={sy(100)} y2={sy(100)} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
