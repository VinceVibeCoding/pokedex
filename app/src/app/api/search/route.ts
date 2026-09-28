// GET /api/search?q=charizard+151 — name search for the search-as-you-type box.
// Always 200 with a (possibly empty) result list; the catalog changes rarely,
// so responses are cacheable for a few minutes.

import { NextRequest, NextResponse } from "next/server";
import { searchCardsPage } from "@/serving/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const { results, total } = q.trim().length === 0 ? { results: [], total: 0 } : await searchCardsPage(q, { limit: 12 });
  return NextResponse.json(
    { results, total },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
