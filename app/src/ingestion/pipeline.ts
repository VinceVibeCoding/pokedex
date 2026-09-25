// Ingestion pipeline — the slow, async plane.
// fetch (per source, isolated) → normalize (grade detection) → dedupe → persist.
// A source that throws or is unhealthy is skipped and reported; it never
// affects the other sources or the serving plane.

import { getPrisma } from "../lib/prisma";
import { normalizeCondition } from "./gradeDetect";
import type { SourceAdapter } from "./adapters/types";

export interface SourceResult {
  source: string;
  displayName: string;
  status: "ok" | "skipped_unhealthy" | "failed";
  fetched: number;
  inserted: number;
  error?: string;
}

export interface IngestionReport {
  cardId: string;
  results: SourceResult[];
  totalInserted: number;
  ranAt: string;
}

export async function ingestCard(
  cardId: string,
  adapters: SourceAdapter[],
): Promise<IngestionReport> {
  const prisma = getPrisma();
  const results: SourceResult[] = [];

  for (const adapter of adapters) {
    const base = { source: adapter.source, displayName: adapter.displayName };

    // Liveness gate: skip dead sources fast instead of waiting on timeouts.
    try {
      if (!(await adapter.healthCheck())) {
        results.push({ ...base, status: "skipped_unhealthy", fetched: 0, inserted: 0 });
        continue;
      }
    } catch {
      results.push({ ...base, status: "skipped_unhealthy", fetched: 0, inserted: 0 });
      continue;
    }

    try {
      const listings = await adapter.fetchComps(cardId);

      const rows = listings.map((l) => {
        const { gradeTier, condition } =
          l.detectedGrade !== null
            ? { gradeTier: l.detectedGrade, condition: null }
            : normalizeCondition(l.conditionText);
        return {
          cardId,
          gradeTier,
          priceCents: l.priceCents,
          currency: l.currency,
          soldAt: new Date(l.soldAt),
          condition,
          source: adapter.source,
          sourceUrl: l.sourceUrl,
        };
      });

      // Dedupe happens at the DB level via @@unique([source, sourceUrl]).
      const created = await prisma.comp.createMany({ data: rows, skipDuplicates: true });
      results.push({ ...base, status: "ok", fetched: listings.length, inserted: created.count });
    } catch (err) {
      results.push({
        ...base,
        status: "failed",
        fetched: 0,
        inserted: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    cardId,
    results,
    totalInserted: results.reduce((acc, r) => acc + r.inserted, 0),
    ranAt: new Date().toISOString(),
  };
}
