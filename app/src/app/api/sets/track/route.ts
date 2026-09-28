// POST /api/sets/track { setCode } — start tracking every card in a set so the daily
// price job fills in its sales history. Signed-in users only (each set spends the shared
// free-tier API budget). No fetching happens here; it only queues cards.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MAX_SET_TRACK, trackSet } from "@/ingestion/refresh";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { setCode?: unknown } | null;
  if (!body || typeof body.setCode !== "string" || body.setCode === "") {
    return NextResponse.json({ error: "setCode is required" }, { status: 400 });
  }

  const result = await trackSet(body.setCode);
  if (result === "not-found") return NextResponse.json({ error: "Unknown set" }, { status: 404 });
  if (result === "too-large") {
    return NextResponse.json({ error: `That set has more than ${MAX_SET_TRACK} cards — too many to queue at once.` }, { status: 422 });
  }
  return NextResponse.json(result, { status: 201 });
}
