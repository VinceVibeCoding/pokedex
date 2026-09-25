// POST /api/cards/[cardId]/refresh — track a card and fetch its prices in the background.
// Responds immediately (202); the fetch runs after the response via after(), so the
// lookup path never waits on external APIs. Poll GET /api/cards/[cardId] and watch
// `tracking.fetching` to know when it's done. Budget guards live in the ingestion layer.

import { after, NextResponse } from "next/server";
import { refreshCard, sourcesConfigured, trackCard } from "@/ingestion/refresh";

const PAGE_VIEW_MIN_INTERVAL_MS = 30 * 60 * 1000;

export async function POST(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;

  if (!(await trackCard(cardId))) {
    return NextResponse.json({ error: `Unknown card ID: ${cardId}` }, { status: 404 });
  }
  if (!sourcesConfigured()) {
    return NextResponse.json({ started: false, reason: "No price API keys configured" }, { status: 200 });
  }

  after(async () => {
    const result = await refreshCard(cardId, { minIntervalMs: PAGE_VIEW_MIN_INTERVAL_MS });
    console.log(`[refresh] ${cardId}: ${result.status} · raw ${result.raw.status} · graded ${result.graded.status}`);
  });
  return NextResponse.json({ started: true }, { status: 202 });
}
