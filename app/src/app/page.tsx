import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { CardSearch } from "@/components/CardSearch";
import { RecentCards } from "@/components/RecentCards";
import { TopMovers } from "@/components/TopMovers";
import { WatchlistSummary } from "@/components/WatchlistSummary";
import { getTopMovers } from "@/serving/movers";
import { getWatchlist } from "@/serving/watchlist";

export default async function Home() {
  const { userId } = await auth();
  const [movers, watchlist] = await Promise.all([
    getTopMovers(),
    userId ? getWatchlist(userId) : null,
  ]);
  const heroImages = [...movers.gainers, ...movers.losers].map((m) => m.imageUrl).filter((u): u is string => u !== null).slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl pt-[12vh]">
      <div className="relative">
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
        <div className="mt-6">
          <CardSearch autoFocus />
        </div>
        <p className="mt-3 text-sm text-ink-3">
          Search by name, set, or number as printed. Press <kbd className="rounded border border-line px-1">/</kbd> anywhere to search.
        </p>
      </div>
      {watchlist && <WatchlistSummary watchlist={watchlist} />}
      <RecentCards />
      <TopMovers gainers={movers.gainers} losers={movers.losers} />
    </div>
  );
}
