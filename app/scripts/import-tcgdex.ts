// Card catalog import from TCGdex (free, no key, tcgdex.dev) — fills gaps that
// pokemontcg.io's English-only ~20k-card catalog misses: Japanese-exclusive
// promos, regional variants, and other prints. Additive only: a card ID already
// in `cards` (from pokemontcg.io) is left untouched, never overwritten — this
// only inserts cards we don't have yet. Card IDs match pokemontcg.io's scheme
// for English sets (e.g. "base1-4"), so overlap is detected and skipped safely;
// Japanese/other-language sets use their own ID namespace, so nothing collides.
//
//   npm run catalog:import-tcgdex -- --lang ja   # Japanese catalog (~12.8k cards)
//   npm run catalog:import-tcgdex -- --lang en   # English catalog (~23.7k, fills gaps)
//   npm run catalog:import-tcgdex -- --lang fr   # any TCGdex language code

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildSearchText } from "../src/lib/catalog";

const API = "https://api.tcgdex.net/v2";
const CONCURRENCY = 8;

interface CardBrief {
  id: string;
  localId: string;
  name: string;
}

interface SetInfo {
  id: string;
  name: string;
  releaseDate?: string;
  cardCount: { total: number };
}

interface CardDetail {
  id: string;
  localId: string;
  name: string;
  category?: string;
  rarity?: string;
  illustrator?: string;
  image?: string;
  set: { id: string; name: string; cardCount?: { total: number } };
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 8000)));
    return fetchJson(url, attempt + 1);
  }
}

const setCache = new Map<string, SetInfo>();
async function getSet(lang: string, setId: string): Promise<SetInfo> {
  const cached = setCache.get(setId);
  if (cached) return cached;
  const set = await fetchJson<SetInfo>(`${API}/${lang}/sets/${encodeURIComponent(setId)}`);
  setCache.set(setId, set);
  return set;
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once. */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
}

async function main() {
  const langFlag = process.argv.indexOf("--lang");
  const lang = langFlag >= 0 ? process.argv[langFlag + 1] : "en";

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  console.log(`Fetching ${lang} card list from TCGdex…`);
  const briefs = await fetchJson<CardBrief[]>(`${API}/${lang}/cards`);
  console.log(`  ${briefs.length} cards listed`);

  const existing = new Set((await prisma.card.findMany({ select: { id: true } })).map((c) => c.id));
  const missing = briefs.filter((b) => !existing.has(b.id));
  console.log(`  ${missing.length} not yet in our catalog — fetching details (concurrency ${CONCURRENCY})…`);

  let done = 0;
  let inserted = 0;
  let failed = 0;

  await runPool(missing, CONCURRENCY, async (brief) => {
    try {
      const card = await fetchJson<CardDetail>(`${API}/${lang}/cards/${encodeURIComponent(brief.id)}`);
      const set = await getSet(lang, card.set.id);
      const printedTotal = card.set.cardCount?.total ?? set.cardCount.total;
      await prisma.card.upsert({
        where: { id: card.id },
        update: {}, // additive only — never touch a row another source already owns
        create: {
          id: card.id,
          name: card.name,
          setName: card.set.name,
          setCode: card.set.id,
          releaseDate: new Date(set.releaseDate ?? "1996-01-01"),
          cardType: card.category ?? "Unknown",
          rarity: card.rarity ?? "Unknown",
          artist: card.illustrator ?? null,
          number: card.localId,
          imageUrl: card.image ? `${card.image}/low.webp` : null,
          imageUrlLarge: card.image ? `${card.image}/high.png` : null,
          searchText: buildSearchText({
            id: card.id,
            name: card.name,
            setName: card.set.name,
            setCode: card.set.id,
            number: card.localId,
            printedTotal,
            rarity: card.rarity ?? "Unknown",
          }),
        },
      });
      inserted++;
    } catch (err) {
      failed++;
      console.warn(`  failed ${brief.id}: ${(err as Error).message}`);
    } finally {
      done++;
      if (done % 500 === 0) console.log(`  ${done}/${missing.length} (${inserted} inserted, ${failed} failed)`);
    }
  });

  console.log(`TCGdex import complete (lang=${lang}): ${inserted} new cards added, ${failed} failed.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
