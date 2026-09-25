// TCGplayer adapter — STUB.
//
// ⚠️ ADJUSTMENTS REQUIRED BEFORE THIS WORKS IN PRODUCTION:
//   1. API access: TCGplayer's official API requires a developer account and
//      OAuth client credentials (public key + private key). Apply at
//      https://developer.tcgplayer.com — approval is manual and can take days.
//      Env vars needed: TCGPLAYER_PUBLIC_KEY, TCGPLAYER_PRIVATE_KEY.
//   2. Catalog mapping: the API is keyed by TCGplayer's internal productId,
//      NOT our card ID. We need a card-ID → productId mapping table (one-time
//      bulk import from their catalog export, then kept in sync).
//   3. Sales data: completed-sale history comes from the "market price" /
//      sales-snapshot endpoints — verify current endpoint names against the
//      API docs; they change between API versions.
//   4. Grades: TCGplayer condition field distinguishes "Near Mint", "LP", etc.
//      but graded sales appear as separate product conditions — map them to
//      GradeTier in this adapter, don't rely on text parsing.
//   5. Rate limits: the API enforces per-app rate limits — add throttling
//      (token bucket) here, and cache catalog lookups aggressively.

import type { CompSource } from "../../types/domain";
import type { RawListing, SourceAdapter } from "./types";
import { SourceFetchError } from "./types";

export class TcgplayerAdapter implements SourceAdapter {
  readonly source: CompSource = "tcgplayer";
  readonly displayName = "TCGplayer";

  async fetchComps(_cardId: string): Promise<RawListing[]> {
    // TODO: OAuth token (client_credentials) → GET /catalog/products →
    //       map productId → sales history endpoint → normalize to RawListing.
    throw new SourceFetchError(
      this.source,
      "Not implemented: requires TCGplayer API credentials and card-ID→productId mapping (see file header)",
    );
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(
      process.env.TCGPLAYER_PUBLIC_KEY && process.env.TCGPLAYER_PRIVATE_KEY,
    );
  }
}
