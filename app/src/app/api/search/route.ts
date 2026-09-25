// GET /api/search?q=charizard+151 — name search for the search-as-you-type box.
// Always 200 with a (possibly empty) result list; the catalog changes rarely,
// so responses are cacheable for a few minutes.

import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/serving/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = q.trim().length === 0 ? [] : await searchCards(q);
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
