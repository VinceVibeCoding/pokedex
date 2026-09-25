// Collectr adapter — backed by the eBay Finding API (findCompletedItems).
// DECISION (2026-09-21): Collectr has no public API, and its comp data
// largely mirrors eBay sold listings — so this adapter uses the same eBay
// source as one30point.ts, keyed under the `collectr` CompSource so we keep
// source attribution. Requires EBAY_APP_ID in .env.
// Step-by-step setup: .obsidian-vault/setup/01 and 02.
//
// NOTE: this can share one eBay client implementation with One30PointAdapter
// (extract to adapters/ebay.ts when implementing). If we later decide the
// dual-source label adds no value, consolidate to a single `ebay` source —
// that's a small enum migration on CompSource.

import type { CompSource } from "../../types/domain";
import type { RawListing, SourceAdapter } from "./types";
import { SourceFetchError } from "./types";

export class CollectrAdapter implements SourceAdapter {
  readonly source: CompSource = "collectr";
  readonly displayName = "Collectr (eBay)";

  async fetchComps(_cardId: string): Promise<RawListing[]> {
    // TODO: share the eBay findCompletedItems client with One30PointAdapter.
    //       See setup guide .obsidian-vault/setup/02.
    throw new SourceFetchError(
      this.source,
      "Not implemented: EBAY_APP_ID wiring pending — see .obsidian-vault/setup/",
    );
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.EBAY_APP_ID);
  }
}
