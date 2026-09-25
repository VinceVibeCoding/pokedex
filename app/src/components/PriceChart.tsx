"use client";

// 90-day sales scatter for one grade tier + a dashed market-price reference line.
// A point is either one sale or one day's summary (count > 1 → "3 sales, avg").
// Single series → no legend (the section title names it). Hover snaps to the nearest
// sale. Extreme outliers (> 3× market) are pinned to the top edge with a ▲ so one
// freak sale doesn't flatten the chart; the tooltip still shows the real price.
// The "Recent sales" table below it is the accessible table view.

import { useEffect, useRef, useState } from "react";
import { formatCents, formatDate } from "@/lib/format";

export interface ChartPoint {
  at: string; // ISO datetime
  priceCents: number;
  count: number; // sales this point stands for
}

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };
const WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;
const OUTLIER_FACTOR = 3;

interface Point {
  x: number;
  y: number;
  sale: ChartPoint;
  pinned: boolean;
}

function niceTicks(min: number, max: number, count = 3): number[] {
  const span = max - min || max || 1;
  const rough = span / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
}

export function PriceChart({
  sales,
  marketCents,
  asOf,
}: {
  sales: ChartPoint[];
  marketCents: number | null;
  asOf: string; // snapshot time — server and browser must agree on "now"
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = new Date(asOf).getTime();
  const x0 = now - WINDOW_DAYS * DAY_MS;
  const prices = sales.map((s) => s.priceCents);
  const cap = marketCents !== null ? marketCents * OUTLIER_FACTOR : Infinity;
  const inRange = prices.filter((p) => p <= cap);
  const yMaxRaw = Math.max(...inRange, marketCents ?? 0);
  const yMinRaw = Math.min(...inRange, marketCents ?? Infinity);
  const pad = (yMaxRaw - yMinRaw) * 0.12 || yMaxRaw * 0.1 || 100;
  const yMin = Math.max(0, yMinRaw - pad);
  const yMax = yMaxRaw + pad;

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const sx = (t: number) => PAD.left + ((t - x0) / (now - x0)) * innerW;
  const sy = (cents: number) => PAD.top + (1 - (cents - yMin) / (yMax - yMin)) * innerH;

  const points: Point[] = sales.map((sale) => {
    const pinned = sale.priceCents > yMax;
    return {
      x: sx(new Date(sale.at).getTime()),
      y: pinned ? PAD.top : sy(sale.priceCents),
      sale,
      pinned,
    };
  });

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let best: Point | null = null;
    let bestD = Infinity;
    for (const p of points) {
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best && bestD < 60 ** 2 ? best : null);
  }

  const yTicks = niceTicks(yMin, yMax);
  const xTicks = [90, 60, 30, 0].map((d) => now - d * DAY_MS);

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${sales.reduce((n, s) => n + s.count, 0)} sales in the last 90 days`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-none"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(v)} y2={sy(v)} stroke="var(--border)" />
            <text x={PAD.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)" className="tabular">
              {formatCents(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={t}
            x={sx(t)}
            y={HEIGHT - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--text-3)"
          >
            {i === xTicks.length - 1 ? "Today" : `${90 - i * 30}d ago`}
          </text>
        ))}

        {marketCents !== null && (
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={sy(marketCents)}
            y2={sy(marketCents)}
            stroke="var(--text-2)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}

        {points.map((p, i) =>
          p.pinned ? (
            <path
              key={i}
              d={`M${p.x - 5},${p.y + 8} L${p.x + 5},${p.y + 8} L${p.x},${p.y} Z`}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          ),
        )}

        {/* label drawn after the dots so a sale never covers it */}
        {marketCents !== null && (
          <text
            x={width - PAD.right}
            y={sy(marketCents) - 6}
            textAnchor="end"
            fontSize={11}
            fill="var(--text-2)"
            stroke="var(--surface)"
            strokeWidth={4}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            Market {formatCents(marketCents)}
          </text>
        )}

        {hover && (
          <circle cx={hover.x} cy={hover.y} r={7} fill="none" stroke="var(--series-1)" strokeWidth={2} pointerEvents="none" />
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(hover.x - 60, 0), width - 130),
            top: Math.max(hover.y - 52, 0),
          }}
        >
          <div className="tabular font-semibold">
            {formatCents(hover.sale.priceCents)}
            {hover.sale.count > 1 ? <span className="font-normal text-ink-2"> avg · {hover.sale.count} sales</span> : null}
          </div>
          <div className="text-ink-2">
            {formatDate(hover.sale.at)}
            {hover.pinned ? " · off-scale outlier" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
