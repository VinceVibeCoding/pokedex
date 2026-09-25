// Price ingestion job — run daily from cron, or by hand:
//
//   npm run ingest                                   # refresh every tracked card, stalest first, within today's API budget
//   npm run ingest -- --card sv3pt5-199              # track + refresh one card now
//   npm run ingest -- --link sv3pt5-199 --poketrace-id <uuid> [--tcgplayer-id <id>]
//                                                    # fix a card the automatic matcher got wrong
//   npm run ingest -- --status                       # show today's API budget
//   npm run ingest -- --mock --card base1-4          # synthetic individual sales (dev only)
//
// Cards become tracked when someone opens them in the web app, or via --card.

import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { refreshCard, sourcesConfigured, trackCard, type SourceOutcome } from "../src/ingestion/refresh";
import { quotaStatus } from "../src/ingestion/sources/quota";
import { ingestCard } from "../src/ingestion/pipeline";
import { recomputeRollups } from "../src/ingestion/rollup";
import { MockAdapter } from "../src/ingestion/adapters/mock";
import { cacheDelete } from "../src/serving/cache";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const flag = (name: string) => process.argv.includes(name);

function describe(o: SourceOutcome): string {
  switch (o.status) {
    case "ok":
      return `ok (${o.points} days)`;
    case "skipped":
      return `skipped — ${o.reason}`;
    case "quota":
      return `out of budget until ${o.resetsAt}`;
    case "failed":
      return `FAILED — ${o.error}`;
  }
}

async function printBudget() {
  for (const source of ["poketrace", "pokemonpricetracker"] as const) {
    const q = await quotaStatus(source);
    console.log(`  ${source.padEnd(20)} ${q.remaining}/${q.limit} left today`);
  }
}

async function refreshOne(cardId: string) {
  const r = await refreshCard(cardId);
  if (r.status === "unknown_card") return console.log(`  ${cardId}: unknown card ID`);
  if (r.status === "busy") return console.log(`  ${cardId}: already being fetched by another process`);
  console.log(`  ${cardId}`);
  console.log(`    match   ${r.mapping.status === "ok" ? "linked" : describe(r.mapping)}`);
  console.log(`    raw     ${describe(r.raw)}`);
  console.log(`    graded  ${describe(r.graded)}`);
  return r;
}

async function main() {
  const prisma = getPrisma();
  const cardId = arg("--card");

  if (flag("--status")) {
    await printBudget();
    return;
  }

  if (flag("--mock")) {
    if (!cardId) throw new Error("--mock needs --card <id> (it writes fake sales; never run it on real cards)");
    const report = await ingestCard(cardId, [new MockAdapter()]);
    await recomputeRollups(cardId);
    await cacheDelete(cardId);
    console.log(`Mock: ${report.totalInserted} synthetic sales added to ${cardId}`);
    return;
  }

  const linkId = arg("--link");
  if (linkId) {
    const poketraceId = arg("--poketrace-id");
    if (!poketraceId) throw new Error("--link needs --poketrace-id <uuid>");
    if (!(await trackCard(linkId))) throw new Error(`Unknown card ID: ${linkId}`);
    await prisma.trackedCard.update({
      where: { cardId: linkId },
      data: { poketraceId, tcgplayerId: arg("--tcgplayer-id"), mappedAt: new Date(), mappingError: null },
    });
    console.log(`Linked ${linkId} → PokeTrace ${poketraceId}. Fetching prices…`);
    await refreshOne(linkId);
    return;
  }

  if (!sourcesConfigured()) {
    console.log("No price API keys set. Add POKETRACE_API_KEY and POKEMONPRICETRACKER_API_KEY to app/.env.");
    return;
  }

  console.log("API budget before:");
  await printBudget();

  if (cardId) {
    await refreshOne(cardId);
  } else {
    // Stalest first, so if the budget runs out the oldest prices got updated.
    const tracked = await prisma.trackedCard.findMany({
      orderBy: [{ lastRefreshedAt: { sort: "asc", nulls: "first" } }],
      select: { cardId: true },
    });
    console.log(`Refreshing ${tracked.length} tracked card(s)…`);
    for (const { cardId: id } of tracked) {
      const r = await refreshOne(id);
      // Both sources out of budget → nothing else can succeed today.
      if (r && r.raw.status === "quota" && r.graded.status === "quota") {
        console.log("Both sources are out of budget for today — stopping.");
        break;
      }
    }
  }

  console.log("API budget after:");
  await printBudget();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
    process.exit(); // the Redis client keeps reconnecting in the background; don't let it hold the process
  });
