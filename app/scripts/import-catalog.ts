// Card catalog import from pokemontcg.io (free; names, numbers, sets, images).
// Fills the `cards` table so name search works for every card — prices come
// separately from the ingestion adapters. Idempotent: re-running updates rows.
//
//   npm run catalog:import                 # every English card (~20k, a few minutes)
//   npm run catalog:import -- --set sv3pt5 # one set (ids: https://api.pokemontcg.io/v2/sets)
//
// Optional: POKEMONTCG_API_KEY in .env raises the rate limit (free key at pokemontcg.io).

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildSearchText } from "../src/lib/catalog";

const API = "https://api.pokemontcg.io/v2/cards";
const PAGE_SIZE = 250;
const FIELDS = "id,name,number,rarity,supertype,artist,images,set";

interface ApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype: string;
  artist?: string;
  images?: { small?: string; large?: string };
  set: { id: string; name: string; printedTotal?: number; releaseDate: string };
}

interface ApiPage {
  data: ApiCard[];
  totalCount: number;
}

async function fetchPage(page: number, setId: string | null, attempt = 1): Promise<ApiPage> {
  const url = new URL(API);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("select", FIELDS);
  url.searchParams.set("orderBy", "set.releaseDate,number");
  if (setId) url.searchParams.set("q", `set.id:${setId}`);

  const headers: Record<string, string> = {};
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ApiPage;
  } catch (err) {
    if (attempt >= 4) throw err;
    const waitMs = 2000 * attempt;
    console.warn(`  page ${page} failed (${(err as Error).message}), retrying in ${waitMs / 1000}s`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchPage(page, setId, attempt + 1);
  }
}

function toRow(c: ApiCard) {
  const data = {
    name: c.name,
    setName: c.set.name,
    setCode: c.set.id,
    releaseDate: new Date(c.set.releaseDate.replace(/\//g, "-")),
    cardType: c.supertype.replace("é", "e"), // "Pokémon" → "Pokemon", matches existing rows
    rarity: c.rarity ?? "Unknown",
    artist: c.artist ?? null,
    number: c.number,
    imageUrl: c.images?.small ?? null,
    imageUrlLarge: c.images?.large ?? null,
    searchText: buildSearchText({
      id: c.id,
      name: c.name,
      setName: c.set.name,
      setCode: c.set.id,
      number: c.number,
      printedTotal: c.set.printedTotal,
    }),
  };
  return { id: c.id, data };
}

async function main() {
  const setFlag = process.argv.indexOf("--set");
  const setId = setFlag >= 0 ? process.argv[setFlag + 1] : null;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  let imported = 0;
  let total = Infinity;

  try {
    for (let page = 1; (page - 1) * PAGE_SIZE < total; page++) {
      const result = await fetchPage(page, setId);
      total = result.totalCount;
      // Static metadata only — never touch pullRate/printVariant a human may have set.
      await prisma.$transaction(
        result.data.map(toRow).map(({ id, data }) =>
          prisma.card.upsert({ where: { id }, update: data, create: { id, ...data } }),
        ),
      );
      imported += result.data.length;
      console.log(`  ${imported}/${total} cards`);
      if (result.data.length === 0) break;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`Catalog import complete: ${imported} cards${setId ? ` from set ${setId}` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
