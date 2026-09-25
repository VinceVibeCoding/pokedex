# 2026-09-25 — Sold-price data source

**Problem:** Both planned adapters (130point, Collectr) depended on the eBay Finding API `findCompletedItems`, decommissioned 2025-02-05. Marketplace Insights (its replacement) is closed to new developers; the Browse API only has active listings.

**Checked (2026-09-25):**
| | Free tier | Individual sales |
|---|---|---|
| PokemonPriceTracker | 100 credits/day, history `days` ≤ 3, personal use only | Never on free/Pro (`soldListings` = Business $99/mo) |
| PokeTrace | 250 req/day, 1 req/2s, **raw only** (graded = Pro $19.99) | Scale plan only ($98/mo) — `/cards/{id}/listings` |

**Decision:** free tiers, **daily summaries** (user choice). Upgrade path to individual sales = PokeTrace Scale; the Comp model and analysis already support it.

**How it works:**
- Raw: PokeTrace `/cards/{id}/prices/NEAR_MINT/history` — daily avg + saleCount per source (eBay, TCGplayer).
- PSA 8/9/10: PokemonPriceTracker `/cards?tcgPlayerId=…&includeEbay=true&limit=1` (2 credits) — `ebay.priceHistory[grade][date] = {average, count}`.
- Card linking: PokeTrace search (name + number, set name match) → its `refs.tcgplayerId` keys PokemonPriceTracker. Wrong match → `npm run ingest -- --link <cardId> --poketrace-id <uuid> [--tcgplayer-id <id>]`.
- Stored in `daily_prices`; one source per tier (never mixed — they overlap). Analysis weights each day by its sale count (`analysis/stats.ts`).
- Budget: only **tracked** cards (opened in the app) are fetched. ~50 cards/day graded (PPT), ~100 raw (PokeTrace). `source_quotas` stops before daily limits; a daily 429 stops that source until reset.
- Free graded history starts at 3 days and grows daily; the UI flags <14 days of history.

**Unverified until real keys:** exact PokeTrace `card_number` format and history `period` allowed on free (code handles both: retries by name, steps 90d→30d→7d).
