// The one lookup entry point for every UI: API route and server-rendered pages
// both call this, so there's a single cache path and a single response shape.

import { cacheGet, cacheSet } from "./cache";
import { getCardSnapshot } from "./snapshot";
import { getPrisma } from "../lib/prisma";
import { FETCH_LOCK_MS, sourcesConfigured } from "../ingestion/refresh";
import type { CardLookupResponse, CardSnapshot, GradeTier, TrackingStatus } from "../types/domain";

/** Price-fetch state — one primary-key read, never cached (it changes mid-fetch). */
async function trackingStatus(cardId: string): Promise<TrackingStatus> {
  const row = await getPrisma().trackedCard.findUnique({ where: { cardId } });
  return {
    sourcesConfigured: sourcesConfigured(),
    tracked: row !== null,
    fetching: row?.fetchStartedAt != null && Date.now() - row.fetchStartedAt.getTime() < FETCH_LOCK_MS,
    lastRefreshedAt: row?.lastRefreshedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    mappingError: row?.poketraceId ? null : (row?.mappingError ?? null),
  };
}

/** Returns null only for an unknown card ID. `grade` null → the card's default tier. */
export async function lookupCard(
  cardId: string,
  grade: GradeTier | null,
): Promise<CardLookupResponse | null> {
  let snapshot = await cacheGet<CardSnapshot>(cardId);
  if (!snapshot) {
    snapshot = await getCardSnapshot(cardId);
    if (!snapshot) return null;
    await cacheSet(cardId, snapshot);
  }
  const tracking = await trackingStatus(cardId);
  return { ...snapshot, selectedTier: grade ?? snapshot.defaultTier, tracking };
}
