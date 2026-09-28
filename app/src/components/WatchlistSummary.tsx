import Link from "next/link";
import { formatCents, formatPct } from "@/lib/format";
import type { WatchlistSummary as WatchlistSummaryData } from "@/serving/watchlist";

export function WatchlistSummary({ watchlist }: { watchlist: WatchlistSummaryData }) {
  if (watchlist.rows.length === 0) return null;
  const plColor = watchlist.totalPlCents === null ? "var(--text-2)" : watchlist.totalPlCents >= 0 ? "var(--good)" : "var(--critical)";

  return (
    <Link
      href="/watchlist"
      className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2"
    >
      <div>
        <div className="text-sm text-ink-2">Your watchlist · {watchlist.rows.length} card{watchlist.rows.length === 1 ? "" : "s"}</div>
        <div className="tabular mt-1 text-2xl font-semibold">
          {watchlist.totalValueCents !== null ? formatCents(watchlist.totalValueCents) : "—"}
        </div>
      </div>
      {watchlist.totalPlCents !== null && (
        <div className="tabular text-right text-lg font-semibold" style={{ color: plColor }}>
          {formatCents(watchlist.totalPlCents)}
          {watchlist.totalPlPct !== null && <div className="text-sm">{formatPct(watchlist.totalPlPct, 1)}</div>}
        </div>
      )}
    </Link>
  );
}
