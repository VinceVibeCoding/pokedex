// Bulk price snapshot for the whole catalog (pokemontcg.io). Idempotent per UTC day.
//
//   npm run snapshot:prices                  # every page (~80 pages for the English catalog)
//   npm run snapshot:prices -- --start-page 40   # resume a run that died partway
//
// The cron (/api/cron/snapshot) does the same daily; run this once by hand to seed the table.

import "dotenv/config";
import { snapshotPrices } from "../src/ingestion/priceSnapshot";

async function main() {
  const flag = process.argv.indexOf("--start-page");
  const startPage = flag >= 0 ? Number(process.argv[flag + 1]) : 1;
  const run = await snapshotPrices({ startPage });
  console.log(`Snapshot ${run.day}: ${run.saved} price rows from ${run.pages} pages (${run.total} cards in the feed).`);
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
