import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWatchlist } from "@/serving/watchlist";
import { WatchlistTable } from "@/components/WatchlistTable";
import { WatchlistRefreshTrigger } from "@/components/WatchlistRefreshTrigger";

export const metadata: Metadata = { title: "My watchlist" };

// proxy.ts already gates this route, but a direct/prefetched hit before the
// session cookie lands can still reach here — redirect rather than 500.
export default async function WatchlistPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/watchlist");

  const watchlist = await getWatchlist(userId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My watchlist</h1>
        <p className="mt-1 text-ink-2">Cards you own, live value, and what&apos;s moving.</p>
      </div>
      <WatchlistRefreshTrigger hasItems={watchlist.rows.length > 0} />
      <WatchlistTable watchlist={watchlist} />
    </div>
  );
}
