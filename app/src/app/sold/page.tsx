import type { Metadata } from "next";
import Link from "next/link";
import { CardTile } from "@/components/CardTile";
import { formatDate, formatCents } from "@/lib/format";
import { GRADE_LABELS, GRADE_TIERS, isGradeTier } from "@/lib/grade";
import { getSoldHistory, type SoldSort } from "@/serving/sold";

export const metadata: Metadata = { title: "Sold History" };
export const dynamic = "force-dynamic";

export default async function SoldPage({ searchParams }: { searchParams: Promise<{ grade?: string; sort?: string }> }) {
  const sp = await searchParams;
  const grade = isGradeTier(sp.grade) ? sp.grade : null;
  const sort: SoldSort = sp.sort === "price" ? "price" : "recent";
  const sales = await getSoldHistory({ grade, sort });

  const href = (g: string | null, s: SoldSort) => {
    const q = new URLSearchParams();
    if (g) q.set("grade", g);
    if (s !== "recent") q.set("sort", s);
    const qs = q.toString();
    return qs ? `/sold?${qs}` : "/sold";
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line text-ink-2 hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sold History</h1>
        <p className="mt-1 text-ink-2">Cards that sold in the last 30 days, at the average price for each day.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href(null, sort)} className={pill(grade === null)}>All grades</Link>
        {GRADE_TIERS.map((g) => (
          <Link key={g} href={href(g, sort)} className={pill(grade === g)}>{GRADE_LABELS[g]}</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={href(grade, "recent")} className={pill(sort === "recent")}>Newest</Link>
        <Link href={href(grade, "price")} className={pill(sort === "price")}>Highest price</Link>
      </div>
      {sales.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          No sales recorded for this filter yet. Look up a card to start tracking it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sales.map((s) => (
            <CardTile
              key={`${s.cardId}:${s.gradeTier}:${s.date}`}
              cardId={s.cardId}
              name={s.cardName}
              setName={s.setName}
              imageUrl={s.imageUrl}
              gradeTier={s.gradeTier}
              priceCents={s.avgPriceCents}
              meta={`${formatDate(s.date)} · ${s.saleCount} sold${s.highPriceCents ? ` · high ${formatCents(s.highPriceCents)}` : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
