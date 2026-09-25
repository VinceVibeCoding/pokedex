# Data Source Setup — Step by Step

Guides to get real comp data flowing into the ingestion plane. Work through them in order:

1. [01-ebay-developer-account.md](01-ebay-developer-account.md) — create the eBay developer account and get your `EBAY_APP_ID` (covers **both** 130point and Collectr replacement)
2. [02-ebay-api-access.md](02-ebay-api-access.md) — enable the right API, configure keys, verify with a test call
3. [03-configure-app.md](03-configure-app.md) — put the keys into this project's `.env` and run ingestion
4. [04-tcgplayer-later.md](04-tcgplayer-later.md) — optional; why TCGplayer is deferred and how to add it later

**Decision log (2026-09-21):**
- 130point and Collectr are both replaced by the **eBay API** — 130point is just a frontend over eBay completed sales, and Collectr has no public API. One credential (`EBAY_APP_ID`) covers both adapters.
- TCGplayer is **deferred, not dropped**. eBay sold data covers the majority of the market; TCGplayer adds its market-price benchmark later as a drop-in adapter.
