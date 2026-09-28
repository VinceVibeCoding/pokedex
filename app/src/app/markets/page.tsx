import type { Metadata } from "next";
import Link from "next/link";
import { formatCents, formatPct } from "@/lib/format";
import { getMarketSegments, type Segment, type SegmentBy } from "@/serving/markets";

export const metadata: Metadata = { title: "Markets" };
export const dynamic = "force-dynamic";

const VIEWS: Array<{ value: SegmentBy; label: string; noun: string }> = [
  { value: "era", label: "Eras", noun: "era" },
  { value: "set", label: "Sets", noun: "set" },
  { value: "rarity", label: "Rarities", noun: "rarity" },
];

export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.value === sp.by) ?? VIEWS[0];
  const data = await getMarketSegments(view.value);

  const withChange = (data?.segments ?? []).filter((s) => s.changePct !== null);
  const rising = [...withChange].sort((a, b) => b.changePct! - a.changePct!).slice(0, 3).filter((s) => s.changePct! > 0);
  const falling = [...withChange].sort((a, b) => a.changePct! - b.changePct!).slice(0, 3).filter((s) => s.changePct! < 0);
  const rows = [...(data?.segments ?? [])].sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
  const pill = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line text-ink-2 hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="mt-1 max-w-3xl text-ink-2">Which eras, sets and rarities are moving. Each change compares the same cards then and now, so new releases can&apos;t fake growth.</p>
      </div>

      <div className="flex gap-2">
        {VIEWS.map((v) => <Link key={v.value} href={v.value === "era" ? "/markets" : `/markets?by=${v.value}`} className={pill(view.value === v.value)}>{v.label}</Link>)}
      </div>

      {data === null ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          The market snapshot hasn&apos;t been loaded yet. Run <code className="rounded bg-surface-2 px-1">npm run snapshot:prices</code> once (the daily job keeps it fresh after that).
        </p>
      ) : (
        <>
          {withChange.length === 0 && (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
              <strong className="text-ink">Changes are still building.</strong> We record every card&apos;s price daily; a 7-day change appears once a week of history exists (from about 5 Oct 2026) and a 30-day change after a month. Total values below are live.
            </p>
          )}
          {(rising.length > 0 || falling.length > 0) && (
            <section className="grid gap-3 md:grid-cols-2">
              <Recap title={`Leading ${view.noun}s`} segments={rising} color="var(--good)" />
              <Recap title={`Lagging ${view.noun}s`} segments={falling} color="var(--critical)" />
            </section>
          )}

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="p-3 text-left font-normal capitalize">{view.noun}</th>
                  <th className="p-3 text-right font-normal">Cards</th>
                  <th className="p-3 text-right font-normal">Total value</th>
                  <th className="p-3 text-right font-normal">Change</th>
                  <th className="p-3 text-right font-normal">Cards rising</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.key} className="border-b border-line last:border-0">
                    <td className="p-3 font-medium">{s.key}</td>
                    <td className="tabular p-3 text-right text-ink-2">{s.cards.toLocaleString()}</td>
                    <td className="tabular p-3 text-right">{formatCents(s.valueCents)}</td>
                    <td className="tabular p-3 text-right font-semibold" style={{ color: s.changePct === null ? undefined : s.changePct >= 0 ? "var(--good)" : "var(--critical)" }}>
                      {s.changePct === null ? <span className="font-normal text-ink-3">—</span> : <>{s.changePct >= 0 ? "▲" : "▼"} {formatPct(s.changePct, 1).replace(/^[+-]/, "")} <span className="font-normal text-ink-3">{windowLabel(s)}</span></>}
                    </td>
                    <td className="tabular p-3 text-right text-ink-2">{s.pctUp === null ? "—" : `${Math.round(s.pctUp)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">
            Snapshot {data.day}. &quot;Total value&quot; = one copy of every card at TCGplayer market price. Change uses our own price history once we have it (30d, else 7d); until then it falls back to Cardmarket&apos;s 7-day vs 30-day average (labeled &quot;CM&quot;). Cards under $3 are excluded.
          </p>
        </>
      )}
    </div>
  );
}

const windowLabel = (s: Segment) => (s.window === "cm" ? "CM 7d/30d" : s.window ?? "");

function Recap({ title, segments, color }: { title: string; segments: Segment[]; color: string }) {
  if (segments.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-medium" style={{ color }}>{title}</h2>
      <ul className="flex flex-col gap-2 text-sm text-ink-2">
        {segments.map((s) => <li key={s.key}>{s.headline}</li>)}
      </ul>
    </div>
  );
}
