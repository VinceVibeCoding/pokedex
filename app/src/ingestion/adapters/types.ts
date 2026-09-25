// Source adapter interface — every marketplace data source (TCGplayer, Collectr,
// 130point) implements this. The pipeline depends ONLY on this interface, so an
// upstream outage or a broken adapter never affects the serving plane.
//
// Contract:
//   - fetchComps returns raw, unnormalized listings for a card ID (or throws).
//   - The pipeline owns normalization, dedupe, and persistence — adapters only fetch.
//   - Adapters must implement their own timeout + retry internally, and must respect
//     source rate limits (see the per-source stubs for the concrete adjustments needed).

import type { CompSource, GradeTier } from "../../types/domain";

/** A single sale as reported by a source, before normalization. */
export interface RawListing {
  priceCents: number;
  currency: string;
  soldAt: string; // ISO datetime
  /** Free-text condition/grade as written by the seller, e.g. "PSA 9", "NM", "LP". */
  conditionText: string | null;
  /** Grade already detected by the adapter, if the source exposes it structurally. */
  detectedGrade: GradeTier | null;
  sourceUrl: string | null;
}

export interface SourceAdapter {
  readonly source: CompSource;
  /** Human-readable name for logs. */
  readonly displayName: string;
  /** Fetch recent completed sales for a card. Throws on failure — pipeline catches. */
  fetchComps(cardId: string, signal?: AbortSignal): Promise<RawListing[]>;
  /** Cheap liveness check used by the pipeline to skip dead sources. */
  healthCheck(): Promise<boolean>;
}

export class SourceFetchError extends Error {
  constructor(
    public readonly source: CompSource,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${source}] ${message}`);
    this.name = "SourceFetchError";
  }
}

/** Shared fetch helper: timeout + bounded retries with backoff. */
export async function fetchWithRetry(
  source: CompSource,
  url: string,
  init: RequestInit = {},
  { timeoutMs = 8000, retries = 2 }: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) throw new SourceFetchError(source, `HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); // 500ms, 1s
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new SourceFetchError(source, `Failed after ${retries + 1} attempts`, lastError);
}
