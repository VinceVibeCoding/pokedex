# Step 4 — TCGplayer (optional, deferred)

## Why it's deferred
- **eBay covers most of the market.** The majority of high-value card sales (and essentially all graded sales) happen on or are mirrored from eBay. TCGplayer sold comps largely overlap.
- **TCGplayer's signup is slow.** Developer API access requires manual approval (days), plus OAuth credentials and a card-ID→productId mapping table.
- The adapter interface already isolates it — adding it later is a drop-in with zero changes to pipeline/serving code.

## What TCGplayer adds when you're ready
- **Market Price benchmark** — the hobby's canonical "what is this worth" number, useful as a sanity check against eBay comps.
- **Cross-validation** — a second independent source for the source-weighting/reconciliation feature in the plan's "Later" list.
- Better coverage for **raw/ungraded modern cards** (TCGplayer is the dominant venue for those).

## Setup when needed (summary)
1. Apply at https://developer.tcgplayer.com (manual approval — start early).
2. Store keys as `TCGPLAYER_PUBLIC_KEY` / `TCGPLAYER_PRIVATE_KEY` in `.env`.
3. One-time import of their catalog export to build the card-ID→productId mapping table.
4. Implement `fetchComps()` in [tcgplayer.ts](../../app/src/ingestion/adapters/tcgplayer.ts) — see its header for the full adjustment list.

## Decision rule
Add TCGplayer when either is true:
- you notice eBay comps are thin for the cards you actually look up (check `SELECT cardId, count(*) FROM comps GROUP BY 1 ORDER BY 2`), or
- you want the market-price benchmark displayed in the UI.
