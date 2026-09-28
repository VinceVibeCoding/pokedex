import type { Metadata } from "next";
import { IndexChart } from "@/components/IndexChart";
import { formatPct } from "@/lib/format";
import { GRADE_LABELS } from "@/lib/grade";
import { getMarketIndexes } from "@/serving/indexes";

export const metadata: Metadata = { title: "Indexes" };
export const dynamic = "force-dynamic";

const Change = ({ label, pct }: { label: string; pct: number | null }) => (
  <div>
    <div className="text-xs text-ink-3">{label}</div>
    {pct === null ? (
      <div className="text-sm text-ink-3">—</div>
    ) : (
      <div className="tabular text-sm font-semibold" style={{ color: pct >= 0 ? "var(--good)" : "var(--critical)" }}>
        {pct >= 0 ? "▲" : "▼"} {formatPct(pct, 1)}
      </div>
    )}
  </div>
);

export default async function IndexesPage() {
  const indexes = await getMarketIndexes();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Indexes</h1>
        <p className="mt-1 text-ink-2">One basket per grade, tracking how the cards we follow move together. Base = 100 at the start of the 30-day window.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {indexes.map((ix) => (
          <section key={ix.gradeTier} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-ink-2">{GRADE_LABELS[ix.gradeTier]} Index</h2>
                <div className="tabular text-3xl font-semibold">{ix.level === null ? "—" : ix.level.toFixed(1)}</div>
                <div className="text-xs text-ink-3">{ix.cardCount} cards</div>
              </div>
              <div className="flex gap-5">
                <Change label="7 days" pct={ix.change7dPct} />
                <Change label="30 days" pct={ix.change30dPct} />
              </div>
            </div>
            <div className="mt-3">
              <IndexChart points={ix.points} label={`${GRADE_LABELS[ix.gradeTier]} index`} />
            </div>
          </section>
        ))}
      </div>
      <details className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">How the index is calculated</summary>
        <p className="mt-2">
          Each card&apos;s daily average sale price is rebased to 100 on its first day in the window, gaps are carried forward, and the index is the equal-weighted
          mean of those cards. Equal weighting stops one expensive card from dominating. A card joins a basket once it has at least 3 days of sales.
        </p>
      </details>
    </div>
  );
}
