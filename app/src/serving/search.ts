// Name search over the card catalog — powers the search-as-you-type box.
// Every query word must appear in cards.searchText (trigram GIN index makes the
// substring match fast); results are ranked exact name → name prefix → fuzzy
// similarity → newest set first.

import { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";
import { normalizeSearch } from "../lib/catalog";
import type { CardSearchResult } from "../types/domain";

const MAX_RESULTS = 8;
const MAX_TOKENS = 6;

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function searchCards(query: string, limit = MAX_RESULTS): Promise<CardSearchResult[]> {
  const q = normalizeSearch(query);
  const tokens = q.split(" ").filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];

  const matchAll = Prisma.join(
    tokens.map((t) => Prisma.sql`"searchText" LIKE ${`%${escapeLike(t)}%`}`),
    " AND ",
  );

  const rows = await getPrisma().$queryRaw<
    Array<{
      id: string;
      name: string;
      setName: string;
      number: string | null;
      rarity: string;
      releaseDate: Date;
      imageUrl: string | null;
    }>
  >`
    SELECT id, name, "setName", number, rarity, "releaseDate", "imageUrl"
    FROM cards
    WHERE ${matchAll}
    ORDER BY
      (lower(name) = ${q}) DESC,
      (lower(name) LIKE ${`${escapeLike(tokens[0])}%`}) DESC,
      similarity("searchText", ${q}) DESC,
      "releaseDate" DESC
    LIMIT ${Math.min(Math.max(limit, 1), 20)}
  `;

  return rows.map((r) => ({ ...r, releaseDate: r.releaseDate.toISOString().slice(0, 10) }));
}
