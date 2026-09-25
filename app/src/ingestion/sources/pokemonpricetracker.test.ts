import { describe, expect, it } from "vitest";
import { parseEbayHistory } from "./pokemonpricetracker";

describe("parseEbayHistory", () => {
  it("maps PSA 8/9/10 daily history to tiers, in cents", () => {
    const points = parseEbayHistory({
      tcgPlayerId: "517045",
      ebay: {
        priceHistory: {
          psa10: { "2026-09-20": { average: 1250.5, count: 3 }, "2026-09-21": { average: 1300, count: 1 } },
          psa9: { "2026-09-21": { average: 610, count: 4 } },
          cgc9_5: { "2026-09-21": { average: 500, count: 2 } }, // other graders ignored
        },
      },
    });
    expect(points).toHaveLength(3);
    expect(points).toContainEqual(
      expect.objectContaining({ source: "ppt_ebay", gradeTier: "psa10", date: "2026-09-20", avgPriceCents: 125050, saleCount: 3 }),
    );
    expect(points).toContainEqual(expect.objectContaining({ gradeTier: "psa9", avgPriceCents: 61000, saleCount: 4 }));
  });

  it("handles missing eBay data and null days", () => {
    expect(parseEbayHistory(null)).toEqual([]);
    expect(parseEbayHistory({ ebay: null })).toEqual([]);
    expect(parseEbayHistory({ ebay: { priceHistory: { psa10: { "2026-09-20": { average: null, count: 0 } } } } })).toEqual([]);
  });
});
