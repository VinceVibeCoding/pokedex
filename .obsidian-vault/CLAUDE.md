# Pokémon Card Price Intelligence Engine

## Project Vision (Read First)
- **Role:** Expert senior full-stack engineer + applied data scientist.
- **What we are building:** A **price comparison & buy-signal engine for Pokémon cards**. The user enters a card ID and a grade (raw / PSA 8 / 9 / 10); the system instantly returns what they should pay at different markup levels, a market stability index, a grade-value comparison (is raw vs PSA 8 vs 9 vs 10 the better buy), and a data-science-driven "good buy / will trend higher" score — think stock analysis, but for cards.
- **North star: latency.** This tool is used live (e.g., while browsing a marketplace). Every architectural decision should bias toward *sub-second response for a card lookup*. Cache aggressively, precompute aggressively, denormalize shamelessly.

## Core Domain Concepts (use this vocabulary in code)
- **Comp:** a completed sale of a specific card **at a specific grade** (price, date, condition, marketplace, grade). Grade is part of the comp's identity — never mix raw and graded comps in the same calculation.
- **Authoritative comp sources:** eBay sold listings (via the Finding API, `EBAY_APP_ID`) back both the 130point and Collectr adapters; TCGplayer is deferred (see setup/04). Each source gets its own ingestion adapter; always record which source a comp came from so sources can be weighted or reconciled later. Setup guides: [setup/](setup/00-README.md).
- **Card ID:** the canonical lookup key. One card = one row of static metadata + a time series of comps **per grade tier**.
- **Grade tier:** `raw`, `psa8`, `psa9`, `psa10` (extensible to other graders later — model grade as data, not as separate tables).
- **Card metadata (static, cache forever):** set, release date, card type/rarity, pull rate, artist, print variant.
- **Market signals (derived from comps, computed per grade tier):** number of sales, most recent sale, sales velocity per day/week/month, price trend, volatility.
- **Market Stability Index:** single composite score computed from volume + recency + volatility. Document its formula in code where computed — never scatter the logic.
- **Buy Score:** the data-science output ("is this a good buy / will it trend up"). Start with transparent heuristics (trend slope, velocity, deviation from moving average) before any ML; every score must be explainable in the UI.
- **Grade Premium Analysis:** compares price-to-value across grade tiers for the same card (e.g., PSA 10 price vs. raw price + grading cost) and recommends which tier is most worth buying.

## Architecture Intent
- **Split the system into two planes:**
  1. **Ingestion plane (slow, async):** fetches/scrapes comps from marketplaces, normalizes them (including grade detection from listings), stores raw + computed signals per grade tier. Batch jobs, queues, cron — never in the request path.
  2. **Serving plane (fast, sync):** card ID + grade → precomputed snapshot. Reads only from cached/aggregated tables. No live external API calls in the request path.
- **External data sources (eBay Finding API for 130point/Collectr; TCGplayer deferred) are unreliable and rate-limited.** Always wrap them behind an internal adapter interface (one adapter per source) with retries, timeouts, and stored fallbacks. Never let an upstream outage break a lookup.
- **Deliverables in order:** (1) web interface for instant lookup → (2) Chrome extension reusing the same API → (3) iPhone app. Design the API as the single product; UIs are thin clients. Keep API responses self-contained (one call returns everything the UI renders).
- **Lookup UX contract:** input is a card ID plus grade selection — quick-toggle buttons for `10 / 9 / 8 / raw` with a manual free-form grade entry as fallback. The response always includes all grade tiers' summaries so the grade comparison renders without a second request.

## Tech Stack
- **Core:** TypeScript, Next.js (App Router), Tailwind CSS, Prisma, PostgreSQL.
- **Time-series data:** store comps in PostgreSQL but design the schema for append-only writes and pre-aggregated rollups (daily/weekly/monthly). If volume justifies it later, evaluate TimescaleDB — do not add it preemptively.
- **Caching:** lookup responses must be cacheable by card ID (e.g., Redis or Next.js route cache) with a short TTL keyed to ingestion freshness.

## Critical Build & Test Commands
- **Install dependencies:** `npm install`
- **Run dev environment:** `npm run dev`
- **Build production asset:** `npm run build`
- **Execute whole test suite:** `npm test`
- **Execute a single test file:** `npm test -- <path_to_file>`
- **Database migration:** `npx prisma migrate dev`

## Code Style & Architecture Guidelines
- **Imports:** ES Modules with destructured imports.
- **Type Safety:** Strict TypeScript, no `any`. Domain types (`Card`, `GradeTier`, `Comp`, `MarketSignals`, `BuyScore`, `GradePremiumAnalysis`) live in one shared types module — UIs and API both import from there.
- **Data fetching:** Server-side first (server components / server actions). Client JS only where interactivity demands it (the extension and mobile app are API consumers, not Next.js pages).
- **Calculations:** All scoring/signal math lives in pure, unit-tested functions under a dedicated `analysis/` module — never inline in route handlers. Each function documents its inputs, formula, and edge cases (e.g., zero-sales cards, single-comp cards).
- **Error handling:** A card (or grade tier) with no comps is a *valid state*, not an error — render an explicit "insufficient data" UI per tier. Only true failures (DB down, adapter timeout) hit error boundaries.

## Development Workflow Rules
- **Testing:** Typecheck before marking any task complete. Prioritize unit tests for the `analysis/` module (scoring correctness matters more than UI coverage). Use realistic fixture comps — edge cases: 0 sales, 1 sale, huge outlier sale, stale last sale, grade tiers with sparse data.
- **Scope creep:** Never refactor unrelated code unless explicitly requested.
- **Reference material:** Idea source: [idea/idea-01.txt](idea/idea-01.txt). For file indices and deeper docs, see root `@README.md`.