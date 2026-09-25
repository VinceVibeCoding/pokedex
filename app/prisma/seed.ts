// Seed script: realistic fixture cards + comps covering the analysis edge cases
// from CLAUDE.md: 0 sales, 1 sale, huge outlier sale, stale last sale,
// grade tiers with sparse data.
// Run with: npm run db:seed

import "dotenv/config";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildSearchText } from "../src/lib/catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY_MS);

type SeedCard = Omit<Prisma.CardCreateInput, "searchText" | "comps" | "rollups"> & {
  id: string;
  number: string | null;
  printedTotal?: number;
};

/** Upserts a card with its search text; re-seeding refreshes metadata. */
function upsertCard({ printedTotal, ...data }: SeedCard) {
  const searchText = buildSearchText({ ...data, printedTotal });
  return prisma.card.upsert({
    where: { id: data.id },
    update: { ...data, searchText },
    create: { ...data, searchText },
  });
}

async function main() {
  // --- Card 1: healthy, liquid chase card — plenty of comps across all tiers ---
  const charizard = await upsertCard({
    id: "base1-4",
    number: "4",
    printedTotal: 102,
    imageUrl: "https://images.pokemontcg.io/base1/4.png",
    imageUrlLarge: "https://images.pokemontcg.io/base1/4_hires.png",
    name: "Charizard",
    setName: "Base Set",
    setCode: "base1",
    releaseDate: new Date("1999-01-09"),
    cardType: "Pokemon",
    rarity: "Rare Holo",
    pullRate: 0.003,
    artist: "Mitsuhiro Arita",
    printVariant: "holo",
  });

  const sources = ["tcgplayer", "collectr", "one30point"] as const;
  const comps: Prisma.CompCreateManyInput[] = [];

  // ~3 raw sales/week for 12 weeks, gently rising 280→360 USD
  for (let i = 0; i < 36; i++) {
    comps.push({
      cardId: charizard.id,
      gradeTier: "raw",
      priceCents: 28000 + i * 220 + Math.round(Math.sin(i) * 800),
      soldAt: daysAgo(84 - i * 2.3),
      condition: "NM",
      source: sources[i % 3],
      sourceUrl: `https://example.com/seed/raw/${i}`,
    });
  }
  // PSA 8: ~2/week, ~2.5x raw
  for (let i = 0; i < 24; i++) {
    comps.push({
      cardId: charizard.id,
      gradeTier: "psa8",
      priceCents: 70000 + i * 500 + Math.round(Math.sin(i * 1.7) * 2500),
      soldAt: daysAgo(84 - i * 3.5),
      source: sources[(i + 1) % 3],
      sourceUrl: `https://example.com/seed/psa8/${i}`,
    });
  }
  // PSA 9: ~1/week, ~6x raw
  for (let i = 0; i < 12; i++) {
    comps.push({
      cardId: charizard.id,
      gradeTier: "psa9",
      priceCents: 170000 + i * 1200 + Math.round(Math.sin(i * 2.1) * 6000),
      soldAt: daysAgo(84 - i * 7),
      source: sources[(i + 2) % 3],
      sourceUrl: `https://example.com/seed/psa9/${i}`,
    });
  }
  // PSA 10: sparse — 4 sales in 12 weeks, one huge outlier
  for (let i = 0; i < 4; i++) {
    comps.push({
      cardId: charizard.id,
      gradeTier: "psa10",
      priceCents: i === 2 ? 2400000 : 900000 + i * 25000, // outlier at index 2
      soldAt: daysAgo(84 - i * 21),
      source: sources[i % 3],
      sourceUrl: `https://example.com/seed/psa10/${i}`,
    });
  }

  // --- Card 2: single comp ever — "insufficient data" territory for most tiers ---
  const pikachu = await upsertCard({
    id: "base1-58",
    number: "58",
    printedTotal: 102,
    imageUrl: "https://images.pokemontcg.io/base1/58.png",
    imageUrlLarge: "https://images.pokemontcg.io/base1/58_hires.png",
    name: "Pikachu",
    setName: "Base Set",
    setCode: "base1",
    releaseDate: new Date("1999-01-09"),
    cardType: "Pokemon",
    rarity: "Common",
    pullRate: 0.12,
    artist: "Mitsuhiro Arita",
    printVariant: null,
  });
  comps.push({
    cardId: pikachu.id,
    gradeTier: "raw",
    priceCents: 450,
    soldAt: daysAgo(6),
    condition: "LP",
    source: "collectr",
    sourceUrl: "https://example.com/seed/pikachu/only-sale",
  });

  // --- Card 3: stale market — last sale 200 days ago ---
  const blastoise = await upsertCard({
    id: "base2-2",
    number: "2",
    printedTotal: 130,
    imageUrl: "https://images.pokemontcg.io/base2/2.png",
    imageUrlLarge: "https://images.pokemontcg.io/base2/2_hires.png",
    name: "Blastoise",
    setName: "Base Set 2",
    setCode: "base2",
    releaseDate: new Date("2000-02-24"),
    cardType: "Pokemon",
    rarity: "Rare Holo",
    pullRate: 0.004,
    artist: "Ken Sugimori",
    printVariant: "holo",
  });
  for (let i = 0; i < 10; i++) {
    comps.push({
      cardId: blastoise.id,
      gradeTier: "raw",
      priceCents: 9000 + i * 100,
      soldAt: daysAgo(300 - i * 10), // newest is 200 days old
      condition: "MP",
      source: sources[i % 3],
      sourceUrl: `https://example.com/seed/blastoise/${i}`,
    });
  }

  // --- Card 4: zero comps — pure "insufficient data" state ---
  await upsertCard({
    id: "sv01-198",
    number: "198",
    imageUrl: null,
    imageUrlLarge: null, // null: exercises the no-image UI state
    name: "Miraidon ex",
    setName: "Scarlet & Violet",
    setCode: "sv01",
    releaseDate: new Date("2023-03-31"),
    cardType: "Pokemon",
    rarity: "Special Illustration Rare",
    pullRate: 0.002,
    artist: null,
    printVariant: "full art",
  });

  // Insert comps idempotently (skip dupes on re-seed via the source+sourceUrl unique key).
  let inserted = 0;
  for (const data of comps) {
    const result = await prisma.comp.createMany({ data: [data], skipDuplicates: true });
    inserted += result.count;
  }

  console.log(`Seed complete: 4 cards, ${inserted} new comps inserted (${comps.length} attempted).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
