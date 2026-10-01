// POST /api/unsubscribe?token=… — turn OFF email alerts on every saved screen of the token's user.
// Not session-gated on purpose: it is the target of the email's one-click link and of the
// List-Unsubscribe-Post header (RFC 8058), and the signed token is the credential.

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function POST(request: NextRequest) {
  const userId = verifyUnsubscribeToken(request.nextUrl.searchParams.get("token"));
  if (!userId) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  const { count } = await getPrisma().savedScreen.updateMany({ where: { userId, notifyEmail: true }, data: { notifyEmail: false } });
  return NextResponse.json({ ok: true, turnedOff: count });
}
