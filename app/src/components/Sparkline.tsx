// Minimal trend line for dense contexts (watchlist rows, home page summary) — no
// axes/ticks/legend, a single 2px line colored by direction (good/critical tokens,
// matching the Verdict/P&L coloring elsewhere), rounded data-end per the dataviz
// mark spec. An aria-label carries the trend as text, since the line itself is
// decorative-only at this size (the full PriceChart is the accessible, interactive
// version on the card page).

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 3;

export function Sparkline({ points }: { points: Array<{ priceCents: number }> }) {
  if (points.length < 2) {
    return <div className="h-7 w-24 text-center text-xs leading-7 text-ink-3">—</div>;
  }
  const values = points.map((p) => p.priceCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;
  const sx = (i: number) => PAD + (i / (points.length - 1)) * (WIDTH - PAD * 2);
  const sy = (v: number) => PAD + (1 - (v - min) / span) * (HEIGHT - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.priceCents).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--good)" : "var(--critical)";
  const changePct = values[0] > 0 ? (((values[values.length - 1] - values[0]) / values[0]) * 100).toFixed(1) : null;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={changePct !== null ? `Trend ${up ? "up" : "down"} ${changePct}% over this period` : "Price trend"}
    >
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(points.length - 1)} cy={sy(values[values.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}
