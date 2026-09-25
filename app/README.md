# Card Index

Instant Pokémon card values: fair price, max buy price, and grade comparison
(raw vs PSA 8/9/10).

## Running it locally (WSL + Docker Desktop)

Prerequisites: Docker Desktop with the WSL2 backend enabled, Node.js 24+, npm.

### 1. Start Postgres + Redis

```bash
cd app
docker compose up -d
docker ps   # expect pokeindex-postgres and pokeindex-redis "Up"
```

### 2. Install dependencies + generate the Prisma client

```bash
npm install
npx prisma generate   # npm's install-script sandboxing can skip this on `npm install` — run it explicitly if `src/generated/prisma` looks stale or missing
```

### 3. Apply migrations and load starter data

```bash
npx prisma migrate deploy
npm run db:seed             # 4 fixture cards with realistic comp data (Charizard, Pikachu, Blastoise, Miraidon ex)
npm run catalog:import      # full card catalog from pokemontcg.io (~20k English cards, a few minutes)
# or just one set, e.g. the 30th Celebration set:
npm run catalog:import -- --set me55
# pokemontcg.io's free tier throws sustained 500/502 runs — resume a failed run instead of restarting:
npm run catalog:import -- --start-page 25

# TCGdex fills what pokemontcg.io misses (130k+ cards across 12 languages —
# Japanese-exclusive promos, Gold Star variants, etc). Additive only: never
# touches a card ID that already exists, only inserts new ones.
npm run catalog:import-tcgdex -- --lang ja   # ~12.8k Japanese cards
npm run catalog:import-tcgdex -- --lang en   # fills English gaps (~3k more than pokemontcg.io has)
```

pokemontcg.io itself is being shut down **March 1, 2027** (folded into a paid
successor, Scrydex) — TCGdex is the free path forward if/when this needs to
become the primary catalog source.

### 4. Configure API keys (optional but needed for live prices / photo search)

Copy `.env.example`-style values into `app/.env` (already gitignored — see below):

| Variable | What it powers | Get it from |
|---|---|---|
| `DATABASE_URL` | Postgres connection | already set for the docker-compose stack above |
| `POKETRACE_API_KEY` | Raw (near-mint) daily price history | https://poketrace.com → sign up → dashboard |
| `POKEMONPRICETRACKER_API_KEY` | PSA 8/9/10 graded price history | https://www.pokemonpricetracker.com → sign up |
| `ANTHROPIC_API_KEY` | Search-by-photo (reads the card off an uploaded image) | https://console.anthropic.com → API Keys → **create the key scoped to a specific workspace**, not org-wide, or vision calls fail with a workspace-scoping error |

Leave any of these empty to run without that feature — the app degrades gracefully
(no live prices, or the photo-search button returns "not configured").

See `.obsidian-vault/decisions/2026-09-25-data-source.md` for why these two price
sources were chosen and how the free-tier budgets work.

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## How prices actually update

There's no cron running by default. A card's prices refresh when:

- someone opens that card's page (throttled to once per 30 min per card), or
- you run `npm run ingest` by hand (refreshes every tracked card, stalest first)

API quotas (PokeTrace 250 req/day, PokemonPriceTracker 100 credits/day) reset at
UTC midnight. Check today's usage: `npm run ingest -- --status`.

## Useful commands

```bash
npm run dev                              # start the app
npm run test                             # vitest
npm run lint                             # eslint
npm run ingest -- --status               # today's API budget
npm run ingest -- --card <cardId>        # force-refresh one card now
npm run ingest -- --link <cardId> --poketrace-id <uuid>  # fix a bad auto-match
npx prisma studio                        # browse the database
docker compose down                      # stop postgres/redis (data persists in volumes)
```

## Restarting after a reboot

Docker Desktop and its containers don't survive a WSL/Windows reboot on their own:

```bash
cd app
docker compose up -d   # postgres + redis
npm run dev            # if not already running
```

## Deployment

Live on Vercel (Hobby, free tier) at https://app-nine-phi-aig9hyxxam.vercel.app,
with Neon (Postgres, free tier) and Upstash (Redis, free tier) as Vercel
Marketplace integrations — both set `DATABASE_URL`/`REDIS_URL` automatically,
no code changes needed versus the local docker-compose setup. GitHub pushes to
`main` auto-deploy (Vercel's GitHub App is installed on the repo, which must
stay **public** — Hobby's private-repo collaboration restriction blocks
deploys otherwise).

A price refresh runs daily via Vercel Cron (`vercel.json` → `/api/cron/ingest`,
00:05 UTC, guarded by `CRON_SECRET`) — see "How prices actually update" above
for what that job does.

**`vercel-build` must run `prisma generate` explicitly** (`package.json`) —
`postinstall` alone isn't reliable: Vercel can restore a cached `node_modules`
from a prior deploy, which makes `npm install` skip lifecycle scripts entirely
(prints "up to date", never runs `postinstall`), breaking the build with
`Module not found: '../generated/prisma/client'`. Putting `prisma generate`
directly in `vercel-build` sidesteps the caching behavior since it's not
contingent on the install step running.

To deploy by hand: `npx vercel deploy --prod` (needs `npx vercel login` once).
Production env vars (API keys, `DATABASE_URL`, `CRON_SECRET`, etc.) live only
in Vercel's dashboard — pull them locally with `npx vercel env pull --environment=production .env.production.local` when you need to run a script (like a catalog import) against the real database.

## Secrets

Real API keys live only in `app/.env`, which is gitignored. Never commit it.
If you're pasting a key in from somewhere and want a scratch file to stage it in,
`api_keys.txt` at the repo root is gitignored too — clear it out once the key is
in `.env`.
