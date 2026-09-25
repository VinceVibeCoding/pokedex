// GET /api/cards/[cardId]?grade=psa9
// The single product API — one self-contained response per lookup.
// Cached by card ID in Redis (5 min TTL keyed to ingestion freshness).
// Unknown card → 404. Tier with no comps → nulls in the response, NOT an error.
// `grade` only sets `selectedTier`; every tier is always included.

import { NextRequest, NextResponse } from "next/server";
import { lookupCard } from "@/serving/lookup";
import { isGradeTier } from "@/lib/grade";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const grade = request.nextUrl.searchParams.get("grade");

  if (grade !== null && !isGradeTier(grade)) {
    return NextResponse.json(
      { error: `Invalid grade "${grade}". Expected one of: raw, psa8, psa9, psa10.` },
      { status: 400 },
    );
  }

  const lookup = await lookupCard(cardId, grade);
  if (!lookup) {
    return NextResponse.json({ error: `Unknown card ID: ${cardId}` }, { status: 404 });
  }

  return NextResponse.json(lookup, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
