// GET /api/cron/snapshot — daily bulk price snapshot (pokemontcg.io). The catalog is ~80
// pages and the free API is flaky, so one invocation may not finish: progress is kept in
// snapshot_cursor and the job stops before the function limit; the next run (or a manual
// call) resumes from there. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.

import { NextRequest, NextResponse } from "next/server";
import { getCursor, saveCursor, snapshotPrices } from "@/ingestion/priceSnapshot";

export const maxDuration = 300;
const SAFETY_MS = 40_000; // stop early enough that an in-flight page can still finish

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cursor = await getCursor();
  if (cursor.done) return NextResponse.json({ done: true, note: "already complete today" });

  const run = await snapshotPrices({ startPage: cursor.nextPage, deadlineMs: Date.now() + (maxDuration * 1000 - SAFETY_MS) });
  await saveCursor(run.nextPage);
  return NextResponse.json(run);
}
