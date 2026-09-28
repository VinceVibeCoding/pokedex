// POST /api/watchlist/refresh — opportunistically refresh every card in the
// signed-in user's watchlist, tightest-throttle-first. This is the "near real-time"
// mechanism described in the README: there's no per-minute polling of the price
// APIs (the shared free-tier budget can't support that across a whole watchlist),
// but a watchlisted card refreshes on a much shorter throttle than the rest of the
// catalog whenever its owner actually opens the watchlist or home page — plus the
// daily cron job (src/app/api/cron/ingest) as an offline safety net, ordered the
// same way (watchlisted cards first — see src/serving/watchlist.ts).
//
// Fire-and-forget: responds immediately, refreshes run after the response via
// after(), same pattern as /api/cards/[cardId]/refresh.

import { after, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPrisma } from "@/lib/prisma";
import { refreshCard, sourcesConfigured } from "@/ingestion/refresh";

/** Tighter than the 30-min single-card page-view throttle — this is an explicit
 * "check my portfolio" action, so it's worth spending a little more budget on. */
const WATCHLIST_MIN_INTERVAL_MS = 15 * 60 * 1000;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sourcesConfigured()) return NextResponse.json({ started: false, reason: "No price API keys configured" });

  const items = await getPrisma().watchlistItem.findMany({ where: { userId }, distinct: ["cardId"], select: { cardId: true } });
  if (items.length === 0) return NextResponse.json({ started: false, reason: "Watchlist is empty" });

  after(async () => {
    for (const { cardId } of items) {
      const r = await refreshCard(cardId, { minIntervalMs: WATCHLIST_MIN_INTERVAL_MS });
      // Both sources out of today's budget → nothing else in this loop can succeed either.
      if (r.raw.status === "quota" && r.graded.status === "quota") break;
    }
  });
  return NextResponse.json({ started: true, cards: items.length }, { status: 202 });
}
