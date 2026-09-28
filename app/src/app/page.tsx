import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { CardSearch } from "@/components/CardSearch";
import { RecentCards } from "@/components/RecentCards";
import { TopMovers } from "@/components/TopMovers";
import { WatchlistSummary } from "@/components/WatchlistSummary";
import { getTopMovers } from "@/serving/movers";
import { getMarketIndexes } from "@/serving/indexes";
import { getSoldHistory } from "@/serving/sold";
import { CardTile } from "@/components/CardTile";
import { GRADE_LABELS } from "@/lib/grade";
import { formatPct } from "@/lib/format";
import Link from "next/link";
import { getWatchlist } from "@/serving/watchlist";

export default async function Home() {
  const { userId } = await auth();
  const [movers, watchlist, indexes, sold] = await Promise.all([
    getTopMovers(),
    userId ? getWatchlist(userId) : null,
    getMarketIndexes(),
    getSoldHistory({ grade: "psa10", limit: 5 }),
  ]);
  const heroImages = [...movers.gainers, ...movers.losers].map((m) => m.imageUrl).filter((u): u is string => u !== null).slice(0, 4);

  return (
    <div className="flex flex-col gap-10">
      <div className="relative mx-auto w-full max-w-2xl pt-[6vh] text-center">
        {heroImages.length > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.07]">
            {heroImages.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={140}
                height={196}
                unoptimized
                className="absolute rounded-lg"
                style={{ top: `${-20 + i * 40}px`, right: `${-40 + (i % 2) * 260}px`, transform: `rotate(${i % 2 === 0 ? -8 : 8}deg)` }}
              />
            ))}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What&apos;s this card worth?</h1>
        <p className="mt-2 text-ink-2">
          Fair price, the most you should pay, and raw vs PSA 8 / 9 / 10 — in one search.
        </p>
        <div className="mt-6 text-left">
          <CardSearch autoFocus />
        </div>
        <p className="mt-3 text-sm text-ink-3">
          Search by name, set, or number as printed. Press <kbd className="rounded border border-line px-1">/</kbd> anywhere to search.
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {indexes.map((ix) => (
          <Link key={ix.gradeTier} href="/indexes" className="rounded-xl border border-line bg-surface p-3 hover:border-ink-3">
            <div className="text-xs text-ink-3">{GRADE_LABELS[ix.gradeTier]} Index</div>
            <div className="tabular text-xl font-semibold">{ix.level === null ? "—" : ix.level.toFixed(1)}</div>
            {ix.change7dPct !== null && (
              <div className="tabular text-xs font-semibold" style={{ color: ix.change7dPct >= 0 ? "var(--good)" : "var(--critical)" }}>
                {ix.change7dPct >= 0 ? "▲" : "▼"} {formatPct(ix.change7dPct, 1)} 7d
              </div>
            )}
          </Link>
        ))}
      </section>
      {watchlist && <WatchlistSummary watchlist={watchlist} />}
      <RecentCards />
      <TopMovers gainers={movers.gainers} losers={movers.losers} />
      {sold.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Latest PSA 10 sales</h2>
            <Link href="/sold?grade=psa10" className="text-sm text-accent hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sold.map((x) => (
              <CardTile key={`${x.cardId}:${x.date}`} cardId={x.cardId} name={x.cardName} setName={x.setName} imageUrl={x.imageUrl} gradeTier={x.gradeTier} priceCents={x.avgPriceCents} meta={`${x.saleCount} sold`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
