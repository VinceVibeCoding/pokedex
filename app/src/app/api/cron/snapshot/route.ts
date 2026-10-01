// GET /api/cron/snapshot — daily bulk price snapshot (pokemontcg.io). The catalog is ~80
// pages and the free API is flaky, so one invocation may not finish: progress is kept in
// snapshot_cursor and the job stops before the function limit; the next run (or a manual
// call) resumes from there. When the snapshot completes it also logs the day's screener flags
// (track record) and sends saved-screen email digests — Vercel Hobby allows only 2 cron jobs,
// so these ride on this one. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.

import { NextRequest, NextResponse } from "next/server";
import { runDigests } from "@/ingestion/digest";
import { logFlags } from "@/ingestion/flagLog";
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
  if (run.nextPage !== null) return NextResponse.json(run); // not finished: the next run resumes, follow-ups wait

  // Snapshot complete → today's flags go into the track-record log, then saved-screen digests go out.
  // Each is isolated: a failure in one never undoes the snapshot or blocks the other.
  const followUps: Record<string, unknown> = {};
  try {
    followUps.flags = await logFlags();
  } catch (err) {
    followUps.flags = { error: (err as Error).message };
  }
  try {
    followUps.digest = await runDigests();
  } catch (err) {
    followUps.digest = { error: (err as Error).message };
  }
  return NextResponse.json({ ...run, ...followUps });
}
