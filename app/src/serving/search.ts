// Name search over the card catalog — powers the search-as-you-type box.
// Every query word must appear in cards.searchText (trigram GIN index makes the
// substring match fast); results are ranked exact name → name prefix → fuzzy
// similarity → newest set first.

import { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";
import { normalizeSearch } from "../lib/catalog";
import type { CardSearchResult } from "../types/domain";

const MAX_RESULTS = 12; // dropdown size; the /search page shows everything
export const PAGE_SIZE = 48;
const MAX_LIMIT = 100;
const MAX_TOKENS = 6;

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function searchCards(query: string, limit = MAX_RESULTS, offset = 0): Promise<CardSearchResult[]> {
  const q = normalizeSearch(query);
  const tokens = q.split(" ").filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];

  const matchAll = whereAll(tokens);

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
    LIMIT ${Math.min(Math.max(limit, 1), MAX_LIMIT)} OFFSET ${Math.max(offset, 0)}
  `;

  return rows.map((r) => ({ ...r, releaseDate: r.releaseDate.toISOString().slice(0, 10) }));
}

function whereAll(tokens: string[]) {
  return Prisma.join(
    tokens.map((t) => Prisma.sql`"searchText" LIKE ${`%${escapeLike(t)}%`}`),
    " AND ",
  );
}

/** Card ids whose searchText contains every query word — used to filter other tables by card. */
export async function searchCardIds(query: string, cap = 2000): Promise<string[]> {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];
  const rows = await getPrisma().$queryRaw<Array<{ id: string }>>`
    SELECT id FROM cards WHERE ${whereAll(tokens)} LIMIT ${cap}
  `;
  return rows.map((r) => r.id);
}

/** One page of matches plus the total match count, for the full results page. */
export async function searchCardsPage(
  query: string,
  { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<{ results: CardSearchResult[]; total: number }> {
  const results = await searchCards(query, limit, offset);
  const q = normalizeSearch(query);
  const tokens = q.split(" ").filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return { results: [], total: 0 };
  const [{ n }] = await getPrisma().$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM cards WHERE ${whereAll(tokens)}
  `;
  return { results, total: n };
}
