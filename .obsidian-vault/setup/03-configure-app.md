# Step 3 — Configure the app & run ingestion

## 3.1 Add the key to `.env`
In [app/.env](../../app/.env), add:

```env
EBAY_APP_ID="YourName-pokecard-PRD-xxxxxxxxxxxx-xxxxxxxx"
```

## 3.2 What happens in code
- The adapters for [one30point.ts](../../app/src/ingestion/adapters/one30point.ts) and [collectr.ts](../../app/src/ingestion/adapters/collectr.ts) both read `EBAY_APP_ID` — their `healthCheck()` already returns `true` once it's set.
- ⚠️ **Implementation still required:** the stubs currently throw `SourceFetchError`. With the key in place, the next coding task is implementing `fetchComps()` in the eBay-backed adapter (calls `findCompletedItems`, maps items → `RawListing`, runs through the existing `detectGradeTier` normalization). Ask Copilot: *"implement the eBay adapter per the header in one30point.ts and the setup guide step 2.5."*
- After implementing, decide whether to keep two adapter instances (tagged `collectr` and `one30point` for source attribution) pointing at the same eBay client, or consolidate to one `ebay` source — the schema's `CompSource` enum makes either easy; consolidating requires a small migration adding `ebay` to the enum.

## 3.3 Run it
```bash
cd app
docker compose up -d          # postgres + redis
npm run ingest                # fetch → normalize → dedupe → rollups
```

Expected output per card: eBay adapter reports `ok — fetched N, inserted M`; stubs for not-yet-configured sources report `skipped_unhealthy` — that's fine.

## 3.4 Verify
```bash
docker compose exec -T postgres psql -U pokeindex -d pokeindex \
  -c 'SELECT source, count(*) FROM comps GROUP BY 1;'
```

## 3.5 Schedule it (production)
- Simplest: a cron entry running `npm run ingest` (e.g. every 6h).
- Later: move to a proper queue (per CLAUDE.md ingestion plane) when card count grows.

➡️ Optional: [04-tcgplayer-later.md](04-tcgplayer-later.md)
