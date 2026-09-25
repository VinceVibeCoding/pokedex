// 130point adapter — backed by the eBay Finding API (findCompletedItems).
// DECISION (2026-09-21): 130point is just a frontend over eBay sold listings,
// so we go straight to the source. Requires EBAY_APP_ID in .env.
// Step-by-step setup: .obsidian-vault/setup/01 and 02.
//
// Implementation notes:
//   - Endpoint: https://svcs.ebay.com/services/search/FindingService/v1
//     OPERATION-NAME=findCompletedItems, SECURITY-APPNAME=$EBAY_APP_ID,
//     itemFilter SoldItemsOnly=true, paginationInput up to 100/page.
//   - Grade detection: titles are free text ("Charizard PSA 9 Base Set") —
//     the pipeline's detectGradeTier handles PSA patterns, but add noise
//     blocklist filters here ("lot", "proxy", "reprint", "custom").
//   - Currency: normalize to USD here or convert at rollup time.
//   - Auction vs BIN: consider tagging listing type; auctions can close low.
//   - Rate limit: ~5,000 calls/day on a free production keyset.

import type { CompSource } from "../../types/domain";
import type { RawListing, SourceAdapter } from "./types";
import { SourceFetchError } from "./types";

export class One30PointAdapter implements SourceAdapter {
  readonly source: CompSource = "one30point";
  readonly displayName = "130point (eBay)";

  async fetchComps(_cardId: string): Promise<RawListing[]> {
    // TODO: call findCompletedItems with SoldItemsOnly, map items → RawListing,
    //       apply noise blocklist. See setup guide .obsidian-vault/setup/02.
    throw new SourceFetchError(
      this.source,
      "Not implemented: EBAY_APP_ID wiring pending — see .obsidian-vault/setup/",
    );
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.EBAY_APP_ID);
  }
}
