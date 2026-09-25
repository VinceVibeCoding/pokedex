// Price refresh for tracked cards — the ingestion plane for the daily-summary sources.
// Flow per card: link to PokeTrace (once) → raw history (PokeTrace) → graded history
// (PokemonPriceTracker) → upsert daily_prices → invalidate the lookup cache.
// Each source is isolated: one failing or out of budget never blocks the other.
// Never called from the lookup path — only from the track API (after the response
// is sent) and the cron script.

import { getPrisma } from "../lib/prisma";
import { cacheDelete } from "../serving/cache";
import { ApiError } from "./sources/http";
import { QuotaExhaustedError } from "./sources/quota";
import { fetchRawHistory, findPokeTraceCard, isPokeTraceConfigured } from "./sources/poketrace";
import { fetchGradedHistory, isPptConfigured } from "./sources/pokemonpricetracker";
import type { DailyPoint } from "./sources/types";

/** A fetch older than this is assumed dead (crashed process) and may be retaken. */
export const FETCH_LOCK_MS = 2 * 60 * 1000;
/** Don't retry a failed card match more often than this — each try costs budget. */
const MAPPING_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

export type SourceOutcome =
  | { status: "ok"; points: number }
  | { status: "skipped"; reason: string }
  | { status: "quota"; resetsAt: string }
  | { status: "failed"; error: string };

export interface RefreshResult {
  cardId: string;
  status: "done" | "busy" | "too_soon" | "unknown_card";
  mapping: SourceOutcome;
  raw: SourceOutcome;
  graded: SourceOutcome;
}

export function sourcesConfigured(): boolean {
  return isPokeTraceConfigured() || isPptConfigured();
}

/** Starts tracking a card (idempotent). Tracked cards are refreshed by the daily job. */
export async function trackCard(cardId: string): Promise<boolean> {
  const prisma = getPrisma();
  const exists = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } });
  if (!exists) return false;
  await prisma.trackedCard.upsert({ where: { cardId }, create: { cardId }, update: {} });
  return true;
}

function outcomeOf(err: unknown): SourceOutcome {
  if (err instanceof QuotaExhaustedError) return { status: "quota", resetsAt: err.resetsAt.toISOString() };
  return { status: "failed", error: err instanceof Error ? err.message : String(err) };
}

async function savePoints(cardId: string, points: DailyPoint[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(
    points.map((p) => {
      const key = { cardId, gradeTier: p.gradeTier, source: p.source, date: new Date(`${p.date}T00:00:00Z`) };
      const values = {
        avgPriceCents: p.avgPriceCents,
        medianPriceCents: p.medianPriceCents,
        lowPriceCents: p.lowPriceCents,
        highPriceCents: p.highPriceCents,
        saleCount: p.saleCount,
        approxSaleCount: p.approxSaleCount,
        fetchedAt: new Date(),
      };
      return prisma.dailyPrice.upsert({
        where: { cardId_gradeTier_source_date: key },
        create: { ...key, ...values },
        update: values,
      });
    }),
  );
}

const BACKFILL_PERIODS = ["90d", "30d", "7d"] as const;
/** Longest history period the plan accepted; remembered so later cards skip refused tries. */
let backfillStart = 0;

/** Raw history: as far back as the plan allows on first fetch, a week on refreshes. */
async function fetchRaw(poketraceId: string, firstFetch: boolean): Promise<DailyPoint[]> {
  if (!firstFetch) return fetchRawHistory(poketraceId, "7d");
  for (let i = backfillStart; i < BACKFILL_PERIODS.length; i++) {
    try {
      const points = await fetchRawHistory(poketraceId, BACKFILL_PERIODS[i]);
      backfillStart = i;
      return points;
    } catch (err) {
      const planRefused = err instanceof ApiError && (err.status === 400 || err.status === 403);
      if (!planRefused || i === BACKFILL_PERIODS.length - 1) throw err;
    }
  }
  return [];
}

/**
 * `minIntervalMs`: skip if the last attempt (success or not) was more recent than this.
 * Page views pass ~30 min so a failing card doesn't retry on every view; cron passes 0.
 */
export async function refreshCard(
  cardId: string,
  { now = new Date(), minIntervalMs = 0 }: { now?: Date; minIntervalMs?: number } = {},
): Promise<RefreshResult> {
  const prisma = getPrisma();
  const skipped = (reason: string): SourceOutcome => ({ status: "skipped", reason });
  const result: RefreshResult = {
    cardId,
    status: "done",
    mapping: skipped("not needed"),
    raw: skipped("not run"),
    graded: skipped("not run"),
  };

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ...result, status: "unknown_card" };
  await trackCard(cardId);

  const before = await prisma.trackedCard.findUnique({ where: { cardId } });
  if (minIntervalMs > 0 && before?.lastAttemptAt && now.getTime() - before.lastAttemptAt.getTime() < minIntervalMs) {
    return { ...result, status: "too_soon" };
  }

  // Take the per-card lock atomically so the web server and cron never double-fetch.
  const lock = await prisma.trackedCard.updateMany({
    where: {
      cardId,
      OR: [{ fetchStartedAt: null }, { fetchStartedAt: { lt: new Date(now.getTime() - FETCH_LOCK_MS) } }],
    },
    data: { fetchStartedAt: now, lastAttemptAt: now },
  });
  if (lock.count === 0) return { ...result, status: "busy" };

  try {
    let tracking = (await prisma.trackedCard.findUnique({ where: { cardId } }))!;
    const firstFetch = tracking.lastRefreshedAt === null;

    // 1. Link to PokeTrace once; that also yields the TCGplayer ID PokemonPriceTracker needs.
    const mappingFresh = tracking.mappedAt && now.getTime() - tracking.mappedAt.getTime() < MAPPING_RETRY_MS;
    if (!tracking.poketraceId && mappingFresh) {
      result.mapping = skipped(`recent match attempt failed: ${tracking.mappingError ?? "unknown"}`);
    } else if (!tracking.poketraceId) {
      if (!isPokeTraceConfigured()) {
        result.mapping = skipped("POKETRACE_API_KEY not set");
      } else {
        try {
          const found = await findPokeTraceCard({ name: card.name, setName: card.setName, number: card.number });
          if ("refs" in found) {
            tracking = await prisma.trackedCard.update({
              where: { cardId },
              data: {
                poketraceId: found.refs.poketraceId,
                tcgplayerId: tracking.tcgplayerId ?? found.refs.tcgplayerId,
                mappedAt: now,
                mappingError: null,
              },
            });
            result.mapping = { status: "ok", points: 0 };
          } else {
            await prisma.trackedCard.update({ where: { cardId }, data: { mappedAt: now, mappingError: found.error } });
            result.mapping = { status: "failed", error: found.error };
          }
        } catch (err) {
          result.mapping = outcomeOf(err);
        }
      }
    }

    // 2. Raw prices (PokeTrace).
    if (!tracking.poketraceId) {
      result.raw = skipped("card not linked to PokeTrace");
    } else if (!isPokeTraceConfigured()) {
      result.raw = skipped("POKETRACE_API_KEY not set");
    } else {
      try {
        const points = await fetchRaw(tracking.poketraceId, firstFetch);
        await savePoints(cardId, points);
        result.raw = { status: "ok", points: points.length };
      } catch (err) {
        result.raw = outcomeOf(err);
      }
    }

    // 3. Graded prices (PokemonPriceTracker).
    if (!tracking.tcgplayerId) {
      result.graded = skipped("no TCGplayer ID for this card");
    } else if (!isPptConfigured()) {
      result.graded = skipped("POKEMONPRICETRACKER_API_KEY not set");
    } else {
      try {
        const points = await fetchGradedHistory(tracking.tcgplayerId);
        await savePoints(cardId, points);
        result.graded = { status: "ok", points: points.length };
      } catch (err) {
        result.graded = outcomeOf(err);
      }
    }

    const anyOk = result.raw.status === "ok" || result.graded.status === "ok";
    const problems = [result.mapping, result.raw, result.graded]
      .map((o) => (o.status === "failed" ? o.error : o.status === "quota" ? "Daily free API limit reached" : null))
      .filter((m): m is string => m !== null);

    await prisma.trackedCard.update({
      where: { cardId },
      data: {
        ...(anyOk ? { lastRefreshedAt: now } : {}),
        lastError: problems.length > 0 ? problems.join(" · ") : null,
      },
    });
    if (anyOk) await cacheDelete(cardId);
    return result;
  } finally {
    await prisma.trackedCard.update({ where: { cardId }, data: { fetchStartedAt: null } });
  }
}
