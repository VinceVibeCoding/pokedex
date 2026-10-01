import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { CardSearch } from "@/components/CardSearch";
import { CardTile } from "@/components/CardTile";
import { RecentCards } from "@/components/RecentCards";
import { ScreenerHighlight } from "@/components/ScreenerHighlight";
import { TopMovers } from "@/components/TopMovers";
import { WatchlistSummary } from "@/components/WatchlistSummary";
import { marketRecap } from "@/analysis/trends";
import { formatCents } from "@/lib/format";
import { getMarketSegments } from "@/serving/markets";
import { getTopMovers } from "@/serving/movers";
import { getScreener } from "@/serving/screener";
import { getSoldFeed, SOURCE_SHORT_LABELS } from "@/serving/sold";
import { getWatchlist } from "@/serving/watchlist";

const SHOWN = 3;

export default async function Home() {
  const { userId } = await auth();
  const [movers, watchlist, trending, undervalued, volume, eras, sold] = await Promise.all([
    getTopMovers(),
    userId ? getWatchlist(userId) : null,
    getScreener({ tag: "trending", sort: "trend" }),
    getScreener({ tag: "undervalued", sort: "dip" }),
    getScreener({ tag: "volume", sort: "volume" }),
    getMarketSegments("era"),
    getSoldFeed({ sort: "recent" }),
  ]);
  const heroImages = [...movers.gainers, ...movers.losers].map((m) => m.imageUrl).filter((u): u is string => u !== null).slice(0, 4);
  const buildingTrends = trending.day !== null && trending.coverage.withOwnHistory === 0 && trending.coverage.withSales === 0;
  const recap = eras ? marketRecap(eras.segments, "era", eras.day) : [];
  const topEras = eras ? [...eras.segments].sort((a, b) => b.valueShare - a.valueShare).slice(0, 5) : [];
  const maxShare = Math.max(0.0001, ...topEras.map((s) => s.valueShare));
  const latestSales = sold.groups.slice(0, 5);

  return (
    <div className="flex flex-col gap-10">
      <div className="relative mx-auto w-full max-w-2xl pt-[4vh] text-center">
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
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Spot the cards before the market moves.</h1>
        <p className="mt-2 text-ink-2">Trends, undervalued cards and sold-listing volume across the whole Pokémon catalog — and a fair price on any card in one search.</p>
        <div className="mt-6 text-left">
          <CardSearch autoFocus />
        </div>
        <p className="mt-3 text-sm text-ink-3">
          Search by name, set, or number as printed. Press <kbd className="rounded border border-line px-1">/</kbd> anywhere to search.
        </p>
      </div>

      <section aria-label="Screener highlights">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">What the screener found</h2>
          <Link href="/screener" className="text-sm text-accent hover:underline">Open the screener →</Link>
        </div>
        {buildingTrends && (
          <p className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm text-ink-2">
            Trend data is still building — we record every card&apos;s price daily, so 7-day trends start appearing in the first week of October. Volume and sold-listing flags are live for the cards we track.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <ScreenerHighlight
            title="Trending up"
            blurb="Price or sold prices rising 10%+ over the last week."
            href="/screener?tag=trending"
            rows={trending.rows.slice(0, SHOWN)}
            emptyText="Nothing is rising 10%+ right now."
          />
          <ScreenerHighlight
            title="Possibly undervalued"
            blurb="Selling 10–40% below their recent average, not in free fall."
            href="/screener?tag=undervalued&sort=dip"
            rows={undervalued.rows.slice(0, SHOWN)}
            emptyText="No cards are trading that far below their average right now."
          />
          <ScreenerHighlight
            title="Selling the most"
            blurb="Highest sold-listing volume among cards we track."
            href="/screener?tag=volume&sort=volume"
            rows={volume.rows.slice(0, SHOWN)}
            emptyText="Track a set to see sales volume here."
          />
        </div>
      </section>

      {recap.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Market pulse</h2>
              <Link href="/markets" className="text-xs text-accent hover:underline">Full recap →</Link>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
              {recap.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-2">Where the value sits, by era</h3>
            <ul className="flex flex-col gap-2">
              {topEras.map((e) => (
                <li key={e.key} className="text-xs">
                  <div className="mb-0.5 flex justify-between gap-2">
                    <span className="truncate">{e.key}</span>
                    <span className="tabular shrink-0 text-ink-3">{formatCents(e.valueCents)} · {(e.valueShare * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (e.valueShare / maxShare) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {latestSales.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Latest sold</h2>
            <Link href="/sold" className="text-sm text-accent hover:underline">All sold history →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {latestSales.map((g) => (
              <CardTile
                key={`${g.cardId}:${g.gradeTier}`}
                cardId={g.cardId}
                name={g.cardName}
                setName={g.setName}
                imageUrl={g.imageUrl}
                gradeTier={g.gradeTier}
                priceCents={g.latest.priceCents}
                badge={SOURCE_SHORT_LABELS[g.latest.source]}
                meta={g.totalSales > 1 ? `${g.totalSales.toLocaleString()} sales` : "1 sale"}
              />
            ))}
          </div>
        </section>
      )}

      {watchlist && <WatchlistSummary watchlist={watchlist} />}
      <RecentCards />
      <TopMovers gainers={movers.gainers} losers={movers.losers} />
    </div>
  );
}
