"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardThumb } from "./CardThumb";
import { LiveFreshness } from "./LiveFreshness";
import { Sparkline } from "./Sparkline";
import { formatCents, formatPct } from "@/lib/format";
import { GRADE_LABELS } from "@/lib/grade";
import type { WatchlistSummary } from "@/serving/watchlist";

function plColor(cents: number | null): string {
  if (cents === null) return "var(--text-3)";
  return cents >= 0 ? "var(--good)" : "var(--critical)";
}

export function WatchlistTable({ watchlist }: { watchlist: WatchlistSummary }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(id: string) {
    setRemoving(id);
    try {
      await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  if (watchlist.rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="font-medium">No cards yet.</p>
        <p className="mt-1 text-sm text-ink-2">
          Search a card, pick a grade, and use &quot;Add to my watchlist&quot; on its page.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Totals label="Total value" value={watchlist.totalValueCents !== null ? formatCents(watchlist.totalValueCents) : "—"} />
        <Totals
          label="Total P&L"
          value={watchlist.totalPlCents !== null ? formatCents(watchlist.totalPlCents) : "—"}
          color={plColor(watchlist.totalPlCents)}
          sub={watchlist.totalPlPct !== null ? formatPct(watchlist.totalPlPct, 1) : undefined}
        />
        <Totals label="Cards tracked" value={String(watchlist.rows.length)} />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-3">
              <th className="px-3 py-2 text-left font-normal">Card</th>
              <th className="px-3 py-2 text-left font-normal">Grade</th>
              <th className="px-3 py-2 text-right font-normal">Qty</th>
              <th className="px-3 py-2 text-right font-normal">Paid</th>
              <th className="px-3 py-2 text-right font-normal">Current</th>
              <th className="px-3 py-2 text-right font-normal">Trend</th>
              <th className="px-3 py-2 text-right font-normal">P&L</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {watchlist.rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2">
                  <a href={`/card/${encodeURIComponent(row.cardId)}?grade=${row.gradeTier}`} className="flex items-center gap-2.5 hover:underline">
                    <CardThumb src={row.imageUrl} alt="" width={28} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.cardName}</div>
                      <div className="truncate text-xs text-ink-2">{row.setName}</div>
                    </div>
                  </a>
                </td>
                <td className="px-3 py-2 text-ink-2">{GRADE_LABELS[row.gradeTier]}</td>
                <td className="tabular px-3 py-2 text-right">{row.quantity}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">
                  {row.acquiredPriceCents !== null ? formatCents(row.acquiredPriceCents) : "—"}
                </td>
                <td className="tabular px-3 py-2 text-right font-medium">
                  {row.currentPriceCents !== null ? formatCents(row.currentPriceCents) : "No sales yet"}
                </td>
                <td className="px-3 py-2">
                  <Sparkline points={row.sparkline} />
                </td>
                <td className="tabular px-3 py-2 text-right font-medium" style={{ color: plColor(row.plCents) }}>
                  {row.plCents !== null ? (
                    <>
                      {formatCents(row.plCents)}
                      {row.plPct !== null && <div className="text-xs">{formatPct(row.plPct, 1)}</div>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(row.id)}
                    disabled={removing === row.id}
                    className="text-xs text-ink-3 hover:text-ink disabled:opacity-50"
                    aria-label={`Remove ${row.cardName} from watchlist`}
                  >
                    {removing === row.id ? "…" : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-ink-3">
        <LiveFreshness at={watchlist.rows[0]?.dataFreshnessAt ?? null} prefix="Newest price data" />
      </p>
    </div>
  );
}

function Totals({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="tabular text-sm" style={color ? { color } : undefined}>
          {sub}
        </div>
      )}
    </div>
  );
}
