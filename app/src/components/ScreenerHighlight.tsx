import Link from "next/link";
import { CardThumb } from "./CardThumb";
import { formatCents, formatPct } from "@/lib/format";
import type { ScreenerRow } from "@/serving/screener";

/** A short ranked list from the screener for the home page — each row says why it is there. */
export function ScreenerHighlight({
  title,
  blurb,
  href,
  rows,
  emptyText,
}: {
  title: string;
  blurb: string;
  href: string;
  rows: ScreenerRow[];
  emptyText: string;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-xs text-accent hover:underline">See all →</Link>
      </div>
      <p className="mb-3 text-xs text-ink-3">{blurb}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-2">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.cardId}>
              <Link href={`/card/${encodeURIComponent(r.cardId)}`} className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-surface-2">
                <CardThumb src={r.imageUrl} alt="" width={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-ink-3">{r.reasons[0] ?? r.setName}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-sm font-semibold">{formatCents(r.priceCents)}</div>
                  {r.trendPct !== null && (
                    <div className="tabular text-xs font-semibold" style={{ color: r.trendPct >= 0 ? "var(--good)" : "var(--critical)" }}>
                      {r.trendPct >= 0 ? "▲" : "▼"} {formatPct(r.trendPct, 1).replace(/^[+-]/, "")}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
