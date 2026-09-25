// Mock adapter — generates deterministic synthetic comps for local development
// and pipeline testing. This is what makes the whole ingestion plane runnable
// before the real source adapters are wired up.

import type { CompSource } from "../../types/domain";
import type { RawListing, SourceAdapter } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export class MockAdapter implements SourceAdapter {
  readonly source: CompSource = "tcgplayer"; // label only; pipeline namespaces by instance
  readonly displayName = "Mock (synthetic data)";

  constructor(
    private readonly compsPerCard = 30,
    private readonly basePriceCents = 10000,
  ) {}

  async fetchComps(cardId: string): Promise<RawListing[]> {
    const now = Date.now();
    return Array.from({ length: this.compsPerCard }, (_, i) => ({
      priceCents: this.basePriceCents + i * 150 + (i % 5) * 200,
      currency: "USD",
      soldAt: new Date(now - i * 2.5 * DAY_MS).toISOString(),
      conditionText: i % 7 === 0 ? "PSA 9" : i % 11 === 0 ? "PSA 10" : "NM",
      detectedGrade: null, // let the pipeline's grade detection do the work
      sourceUrl: `https://mock.local/${cardId}/${i}`,
    }));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
