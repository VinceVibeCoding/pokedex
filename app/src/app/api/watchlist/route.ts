// GET  /api/watchlist            — the signed-in user's holdings + live P&L
// POST /api/watchlist             — add or edit a holding (upsert on user+card+grade;
//                                    POST again with the same card+grade to correct
//                                    quantity/price paid rather than stacking a lot)
// DELETE /api/watchlist?id=<row>  — remove a holding
//
// Auth-gated: every handler 401s without a Clerk session. Never trust a userId from
// the request body — always read it from auth().

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPrisma } from "@/lib/prisma";
import { getWatchlist } from "@/serving/watchlist";
import { isGradeTier } from "@/lib/grade";
import { trackCard } from "@/ingestion/refresh";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(await getWatchlist(userId));
}

interface WatchlistPostBody {
  cardId?: unknown;
  gradeTier?: unknown;
  quantity?: unknown;
  acquiredPriceCents?: unknown;
  acquiredAt?: unknown;
  note?: unknown;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as WatchlistPostBody | null;
  if (!body || typeof body.cardId !== "string" || !isGradeTier(body.gradeTier)) {
    return NextResponse.json({ error: "cardId and a valid gradeTier are required" }, { status: 400 });
  }
  const quantity = typeof body.quantity === "number" && body.quantity > 0 ? Math.floor(body.quantity) : 1;
  const acquiredPriceCents =
    typeof body.acquiredPriceCents === "number" && body.acquiredPriceCents >= 0
      ? Math.round(body.acquiredPriceCents)
      : null;
  const acquiredAt = typeof body.acquiredAt === "string" ? new Date(body.acquiredAt) : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 280) : null;

  if (!(await trackCard(body.cardId))) {
    return NextResponse.json({ error: `Unknown card ID: ${body.cardId}` }, { status: 404 });
  }

  const values = { quantity, acquiredPriceCents, acquiredAt, note };
  await getPrisma().watchlistItem.upsert({
    where: { userId_cardId_gradeTier: { userId, cardId: body.cardId, gradeTier: body.gradeTier } },
    create: { userId, cardId: body.cardId, gradeTier: body.gradeTier, ...values },
    update: values,
  });

  return NextResponse.json(await getWatchlist(userId), { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // userId in the where-clause, not just the id, so no one can delete another user's row.
  const { count } = await getPrisma().watchlistItem.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(await getWatchlist(userId));
}
