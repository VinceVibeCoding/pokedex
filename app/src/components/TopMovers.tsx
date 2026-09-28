// Direct-labeled horizontal bars, one series (this card's % move) so no legend is
// needed — good/critical tokens carry gain/loss, matching the Verdict/P&L coloring
// used everywhere else. Bar length is relative to the larger of the two lists'
// max |change|, so a +40% card and a -5% card are visually honest about scale.

import Link from "next/link";
import { CardThumb } from "./CardThumb";
import { formatCents, formatPct } from "@/lib/format";
import { GRADE_LABELS } from "@/lib/grade";
import type { Mover } from "@/serving/movers";

export function TopMovers({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  if (gainers.length === 0 && losers.length === 0) return null;
  const maxAbs = Math.max(1, ...[...gainers, ...losers].map((m) => Math.abs(m.changePct)));

  return (
    <section className="mt-10 grid gap-4 sm:grid-cols-2">
      <MoverList title="Today's gainers" movers={gainers} color="var(--good)" maxAbs={maxAbs} />
      <MoverList title="Today's losers" movers={losers} color="var(--critical)" maxAbs={maxAbs} />
    </section>
  );
}

function MoverList({ title, movers, color, maxAbs }: { title: string; movers: Mover[]; color: string; maxAbs: number }) {
  if (movers.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-ink-2">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {movers.map((m) => (
          <li key={`${m.cardId}:${m.gradeTier}`}>
            <Link
              href={`/card/${encodeURIComponent(m.cardId)}?grade=${m.gradeTier}`}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2 hover:bg-surface-2"
            >
              <CardThumb src={m.imageUrl} alt="" width={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.cardName}</div>
                <div className="truncate text-xs text-ink-2">
                  {GRADE_LABELS[m.gradeTier]} · {formatCents(m.priceCents)}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(Math.abs(m.changePct) / maxAbs) * 100}%`, background: color }}
                  />
                </div>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold" style={{ color }}>
                {formatPct(m.changePct, 1)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
