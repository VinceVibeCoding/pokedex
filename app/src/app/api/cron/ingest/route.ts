// GET /api/cron/ingest — daily price refresh for every tracked card, watchlisted
// cards first (then stalest first within each group — see watchlistPriority() in
// src/ingestion/refresh.ts). Triggered by Vercel Cron (see vercel.json — once/day,
// matching the free-tier API budgets; per-view refreshes on individual card pages
// and /api/watchlist/refresh cover the gaps between runs). Vercel sends
// `Authorization: Bearer $CRON_SECRET` automatically, so any other caller is
// rejected. Mirrors scripts/ingest.ts's no-args mode.

import { NextRequest, NextResponse } from "next/server";
import { refreshCard, sourcesConfigured, watchlistPriority } from "@/ingestion/refresh";

export const maxDuration = 300; // seconds — Hobby's max; refreshing many cards can take a while

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sourcesConfigured()) {
    return NextResponse.json({ started: false, reason: "No price API keys configured" });
  }

  const tracked = await watchlistPriority();

  let refreshed = 0;
  for (const { cardId } of tracked) {
    const r = await refreshCard(cardId);
    refreshed++;
    // Both sources out of budget → nothing else can succeed today.
    if (r.raw.status === "quota" && r.graded.status === "quota") break;
  }

  return NextResponse.json({ tracked: tracked.length, refreshed });
}
