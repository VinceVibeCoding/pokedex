import type { Metadata } from "next";
import Link from "next/link";
import { CardTile } from "@/components/CardTile";
import { formatDate, formatCents } from "@/lib/format";
import { GRADE_LABELS, GRADE_TIERS, isGradeTier } from "@/lib/grade";
import { getSoldHistory, SOLD_SOURCES, SOURCE_SHORT_LABELS, type SoldSort } from "@/serving/sold";

export const metadata: Metadata = { title: "Sold History" };
export const dynamic = "force-dynamic";

export default async function SoldPage({ searchParams }: { searchParams: Promise<{ grade?: string; sort?: string; source?: string }> }) {
  const sp = await searchParams;
  const grade = isGradeTier(sp.grade) ? sp.grade : null;
  const sort: SoldSort = sp.sort === "price" ? "price" : "recent";
  const source = SOLD_SOURCES.find((x) => x === sp.source) ?? null;
  const sales = await getSoldHistory({ grade, sort, sources: "all", source });

  const href = (g: string | null, s: SoldSort, src: string | null = source) => {
    const q = new URLSearchParams();
    if (g) q.set("grade", g);
    if (s !== "recent") q.set("sort", s);
    if (src) q.set("source", src);
    const qs = q.toString();
    return qs ? `/sold?${qs}` : "/sold";
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line text-ink-2 hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sold History</h1>
        <p className="mt-1 text-ink-2">Cards that sold in the last 30 days, at each day&apos;s average price, from every source we track. eBay appears via two providers, so the same sales can show up twice — compare, don&apos;t add.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href(null, sort)} className={pill(grade === null)}>All grades</Link>
        {GRADE_TIERS.map((g) => (
          <Link key={g} href={href(g, sort)} className={pill(grade === g)}>{GRADE_LABELS[g]}</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={href(grade, "recent")} className={pill(sort === "recent")}>Newest</Link>
        <Link href={href(grade, "price")} className={pill(sort === "price")}>Highest price</Link>
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={href(grade, sort, null)} className={pill(source === null)}>All sources</Link>
        {SOLD_SOURCES.map((x) => (
          <Link key={x} href={href(grade, sort, x)} className={pill(source === x)}>{SOURCE_SHORT_LABELS[x]}</Link>
        ))}
      </div>
      {sales.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          No sales recorded for this filter yet. Look up a card to start tracking it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sales.map((s) => (
            <CardTile
              key={`${s.cardId}:${s.gradeTier}:${s.date}:${s.source}`}
              cardId={s.cardId}
              name={s.cardName}
              setName={s.setName}
              imageUrl={s.imageUrl}
              gradeTier={s.gradeTier}
              priceCents={s.avgPriceCents}
              badge={SOURCE_SHORT_LABELS[s.source]}
              meta={`${formatDate(s.date)} · ${s.saleCount} sold${s.highPriceCents ? ` · high ${formatCents(s.highPriceCents)}` : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
