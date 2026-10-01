// GET    /api/screens            — the signed-in user's saved screens
// POST   /api/screens            — save a screener filter { query, name? }
// PATCH  /api/screens            — { id, notifyEmail } toggle email alerts
// DELETE /api/screens?id=<id>    — remove one
//
// Auth-gated; the userId always comes from the Clerk session, never the request body.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPrisma } from "@/lib/prisma";
import { getScreener } from "@/serving/screener";
import { canonicalQuery, describeQuery, paramsFromQuery, parseScreenerParams } from "@/serving/screenerParams";
import { DIGEST_TOP } from "@/ingestion/digest";

const MAX_SCREENS = 20;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const screens = await getPrisma().savedScreen.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ screens });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { query?: unknown; name?: unknown } | null;
  if (!body || typeof body.query !== "string") return NextResponse.json({ error: "query is required" }, { status: 400 });

  const prisma = getPrisma();
  if ((await prisma.savedScreen.count({ where: { userId } })) >= MAX_SCREENS) {
    return NextResponse.json({ error: `You can save up to ${MAX_SCREENS} screens.` }, { status: 422 });
  }
  const query = canonicalQuery(paramsFromQuery(body.query));
  const name = (typeof body.name === "string" && body.name.trim() ? body.name.trim() : describeQuery(query)).slice(0, 60);

  // Remember what matches right now, so alerts only mention cards that match AFTER saving.
  const now = await getScreener({ ...parseScreenerParams(paramsFromQuery(query)), pageSize: DIGEST_TOP });
  const screen = await prisma.savedScreen.create({ data: { userId, name, query, lastMatchIds: now.rows.map((r) => r.cardId) } });
  return NextResponse.json({ screen }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; notifyEmail?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.notifyEmail !== "boolean") {
    return NextResponse.json({ error: "id and notifyEmail are required" }, { status: 400 });
  }
  const res = await getPrisma().savedScreen.updateMany({ where: { id: body.id, userId }, data: { notifyEmail: body.notifyEmail } });
  return res.count === 0 ? NextResponse.json({ error: "Not found" }, { status: 404 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const res = await getPrisma().savedScreen.deleteMany({ where: { id, userId } });
  return res.count === 0 ? NextResponse.json({ error: "Not found" }, { status: 404 }) : NextResponse.json({ ok: true });
}
