// GET /api/cron/ingest — daily price refresh for every tracked card, stalest first.
// Triggered by Vercel Cron (see vercel.json — once/day, matching the free-tier
// API budgets). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically,
// so any other caller is rejected. Mirrors scripts/ingest.ts's no-args mode.

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { refreshCard, sourcesConfigured } from "@/ingestion/refresh";

export const maxDuration = 300; // seconds — Hobby's max; refreshing many cards can take a while

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sourcesConfigured()) {
    return NextResponse.json({ started: false, reason: "No price API keys configured" });
  }

  const prisma = getPrisma();
  const tracked = await prisma.trackedCard.findMany({
    orderBy: [{ lastRefreshedAt: { sort: "asc", nulls: "first" } }],
    select: { cardId: true },
  });

  let refreshed = 0;
  for (const { cardId } of tracked) {
    const r = await refreshCard(cardId);
    refreshed++;
    // Both sources out of budget → nothing else can succeed today.
    if (r.raw.status === "quota" && r.graded.status === "quota") break;
  }

  return NextResponse.json({ tracked: tracked.length, refreshed });
}
