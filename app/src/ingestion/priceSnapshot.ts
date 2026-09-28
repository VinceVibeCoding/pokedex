// Bulk daily price snapshots for the whole catalog (pokemontcg.io `tcgplayer` + `cardmarket`
// blocks). Feeds the screener and the set/era/rarity summaries — the only market-wide price
// data we have, since sold-listing data (daily_prices) exists only for tracked cards.
//
// Two very different feeds, kept apart on purpose:
//   TCGplayer  — USD, CURRENT price only (no history). Trends come from our own daily rows.
//   Cardmarket — EUR, with 1/7/30-day averages, but `updatedAt` can be weeks stale; a stale
//                row must never be read as a trend (see isFresh()).

import { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";

const API = "https://api.pokemontcg.io/v2/cards";
export const SNAPSHOT_PAGE_SIZE = 250;
export const MIN_STORE_CENTS = 100; // cards cheaper than this (in either currency) are noise and are not stored
export const RETENTION_DAYS = 120;
const SELECT = "id,tcgplayer,cardmarket";

interface TcgVariantPrices { low?: number | null; market?: number | null }
interface ApiPriceCard {
  id: string;
  tcgplayer?: { prices?: Record<string, TcgVariantPrices> } | null;
  cardmarket?: { updatedAt?: string; prices?: Record<string, number | null> } | null;
}
interface ApiPage { data: ApiPriceCard[]; totalCount: number }

export interface SnapshotRow {
  cardId: string;
  tcgVariant: string | null;
  tcgMarketCents: number | null;
  tcgLowCents: number | null;
  cmTrendCents: number | null;
  cmAvg1Cents: number | null;
  cmAvg7Cents: number | null;
  cmAvg30Cents: number | null;
  cmUpdatedAt: string | null; // YYYY-MM-DD
}

const toCents = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null);

// Base printing first: our catalog card is the regular print, so a 1st Edition price is
// only used when nothing else exists (it would otherwise dwarf the unlimited price).
const TCG_VARIANT_ORDER = ["normal", "holofoil", "unlimited", "unlimitedHolofoil", "reverseHolofoil", "1stEdition", "1stEditionHolofoil", "1stEditionNormal"];

export function pickTcgPrice(prices: Record<string, TcgVariantPrices> | undefined | null): { variant: string; market: number | null; low: number | null } | null {
  if (!prices) return null;
  const keys = [...TCG_VARIANT_ORDER.filter((k) => k in prices), ...Object.keys(prices).filter((k) => !TCG_VARIANT_ORDER.includes(k))];
  for (const k of keys) {
    const market = prices[k]?.market ?? null;
    if (typeof market === "number" && market > 0) return { variant: k, market, low: prices[k]?.low ?? null };
  }
  return null;
}

/** null when the card has no usable price or is below the storage floor. */
export function toSnapshotRow(card: ApiPriceCard): SnapshotRow | null {
  const tcg = pickTcgPrice(card.tcgplayer?.prices);
  const cm = card.cardmarket?.prices ?? {};
  const row: SnapshotRow = {
    cardId: card.id,
    tcgVariant: tcg?.variant ?? null,
    tcgMarketCents: toCents(tcg?.market),
    tcgLowCents: toCents(tcg?.low),
    cmTrendCents: toCents(cm.trendPrice),
    cmAvg1Cents: toCents(cm.avg1),
    cmAvg7Cents: toCents(cm.avg7),
    cmAvg30Cents: toCents(cm.avg30),
    cmUpdatedAt: card.cardmarket?.updatedAt ? card.cardmarket.updatedAt.replace(/\//g, "-") : null,
  };
  const biggest = Math.max(row.tcgMarketCents ?? 0, row.cmTrendCents ?? 0, row.cmAvg30Cents ?? 0);
  return biggest >= MIN_STORE_CENTS ? row : null;
}

async function fetchPage(page: number, attempt = 1): Promise<ApiPage> {
  const url = new URL(API);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(SNAPSHOT_PAGE_SIZE));
  url.searchParams.set("select", SELECT);
  url.searchParams.set("orderBy", "id");
  const headers: Record<string, string> = {};
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ApiPage;
  } catch (err) {
    if (attempt >= 5) throw err; // free tier throws runs of 500s; the caller resumes from this page
    await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 15_000)));
    return fetchPage(page, attempt + 1);
  }
}

/** One set-based upsert per page. Rows for cards missing from our catalog are skipped, not errors. */
async function saveRows(rows: SnapshotRow[], day: string): Promise<number> {
  if (rows.length === 0) return 0;
  const col = <T,>(f: (r: SnapshotRow) => T) => rows.map(f);
  return getPrisma().$executeRaw`
    INSERT INTO card_price_snapshots ("cardId","date","tcgVariant","tcgMarketCents","tcgLowCents","cmTrendCents","cmAvg1Cents","cmAvg7Cents","cmAvg30Cents","cmUpdatedAt")
    SELECT u.id, ${day}::date, u.variant, u.market, u.low, u.trend, u.a1, u.a7, u.a30, u.cmu::date
    FROM unnest(
      ${col((r) => r.cardId)}::text[], ${col((r) => r.tcgVariant)}::text[], ${col((r) => r.tcgMarketCents)}::int[], ${col((r) => r.tcgLowCents)}::int[],
      ${col((r) => r.cmTrendCents)}::int[], ${col((r) => r.cmAvg1Cents)}::int[], ${col((r) => r.cmAvg7Cents)}::int[], ${col((r) => r.cmAvg30Cents)}::int[], ${col((r) => r.cmUpdatedAt)}::text[]
    ) AS u(id, variant, market, low, trend, a1, a7, a30, cmu)
    WHERE EXISTS (SELECT 1 FROM cards c WHERE c.id = u.id)
    ON CONFLICT ("cardId","date") DO UPDATE SET
      "tcgVariant" = EXCLUDED."tcgVariant", "tcgMarketCents" = EXCLUDED."tcgMarketCents", "tcgLowCents" = EXCLUDED."tcgLowCents",
      "cmTrendCents" = EXCLUDED."cmTrendCents", "cmAvg1Cents" = EXCLUDED."cmAvg1Cents", "cmAvg7Cents" = EXCLUDED."cmAvg7Cents",
      "cmAvg30Cents" = EXCLUDED."cmAvg30Cents", "cmUpdatedAt" = EXCLUDED."cmUpdatedAt"
  `;
}

export interface SnapshotRun { day: string; nextPage: number | null; pages: number; saved: number; total: number }

/**
 * Snapshots pages starting at `startPage` until the catalog ends or `deadlineMs` passes.
 * `nextPage` is null when the whole catalog is done, otherwise where to resume.
 */
export async function snapshotPrices({ startPage = 1, deadlineMs = Infinity, now = new Date() }: { startPage?: number; deadlineMs?: number; now?: Date } = {}): Promise<SnapshotRun> {
  const day = now.toISOString().slice(0, 10);
  let page = startPage;
  let saved = 0;
  let total = 0;
  for (;;) {
    const result = await fetchPage(page);
    total = result.totalCount;
    saved += await saveRows(result.data.map(toSnapshotRow).filter((r): r is SnapshotRow => r !== null), day);
    const done = page * SNAPSHOT_PAGE_SIZE >= total || result.data.length === 0;
    if (done) {
      await getPrisma().$executeRaw`DELETE FROM card_price_snapshots WHERE "date" < ${new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10)}::date`;
      return { day, nextPage: null, pages: page - startPage + 1, saved, total };
    }
    page++;
    if (Date.now() > deadlineMs) return { day, nextPage: page, pages: page - startPage, saved, total };
  }
}

/** Reads (and rolls over at UTC midnight) the resume cursor used by the cron job. */
export async function getCursor(now: Date = new Date()): Promise<{ nextPage: number; done: boolean }> {
  const prisma = getPrisma();
  const day = new Date(now.toISOString().slice(0, 10));
  const row = await prisma.snapshotCursor.findUnique({ where: { id: "daily" } });
  if (!row || row.day.getTime() !== day.getTime()) {
    await prisma.snapshotCursor.upsert({ where: { id: "daily" }, create: { id: "daily", day }, update: { day, nextPage: 1, done: false } });
    return { nextPage: 1, done: false };
  }
  return { nextPage: row.nextPage, done: row.done };
}

export async function saveCursor(nextPage: number | null): Promise<void> {
  await getPrisma().snapshotCursor.update({ where: { id: "daily" }, data: nextPage === null ? { done: true } : { nextPage } });
}

/** A Cardmarket row is only trustworthy for trends if it was updated within the last few days. */
export function isFresh(cmUpdatedAt: string | Date | null, now: Date = new Date(), maxAgeDays = 3): boolean {
  if (!cmUpdatedAt) return false;
  const t = new Date(cmUpdatedAt).getTime();
  return Number.isFinite(t) && now.getTime() - t <= maxAgeDays * 86_400_000;
}
