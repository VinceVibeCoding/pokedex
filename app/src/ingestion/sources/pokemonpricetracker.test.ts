import { describe, expect, it } from "vitest";
import { parseEbaySales } from "./pokemonpricetracker";

describe("parseEbaySales", () => {
  it("maps PSA 8/9/10 grade aggregates to one point per grade, in cents, dated at the last real sale", () => {
    const points = parseEbaySales({
      tcgPlayerId: "42382",
      ebay: {
        salesByGrade: {
          psa9: { count: 19, averagePrice: 2538.45, medianPrice: 2487.5, minPrice: 1500, maxPrice: 4000, lastSaleDate: "2026-07-30T00:00:00.000Z" },
          psa8: { count: 39, averagePrice: 1016.32, medianPrice: 949.99, minPrice: 610, maxPrice: 1440, lastSaleDate: "2026-09-01T00:00:00.000Z" },
          psa8_5: { count: 2, averagePrice: 1686, medianPrice: 1686, minPrice: 1447, maxPrice: 1925, lastSaleDate: "2026-08-01T00:00:00.000Z" }, // other graders ignored
        },
      },
    });
    expect(points).toHaveLength(2);
    expect(points).toContainEqual(
      expect.objectContaining({
        source: "ppt_ebay",
        gradeTier: "psa9",
        date: "2026-07-30",
        avgPriceCents: 253845,
        medianPriceCents: 248750,
        lowPriceCents: 150000,
        highPriceCents: 400000,
        saleCount: 1,
        approxSaleCount: true,
      }),
    );
    expect(points).toContainEqual(expect.objectContaining({ gradeTier: "psa8", date: "2026-09-01", avgPriceCents: 101632 }));
  });

  it("never uses the real sale count as the weight — it's a rolling multi-month total, not a same-day count", () => {
    const [point] = parseEbaySales({
      ebay: { salesByGrade: { psa10: { count: 500, averagePrice: 100, lastSaleDate: "2026-09-20" } } },
    });
    expect(point.saleCount).toBe(1);
    expect(point.approxSaleCount).toBe(true);
  });

  it("handles missing eBay data, zero-count grades, and grades with no price", () => {
    expect(parseEbaySales(null)).toEqual([]);
    expect(parseEbaySales({ ebay: null })).toEqual([]);
    expect(parseEbaySales({ ebay: { salesByGrade: { psa10: { count: 0, averagePrice: 100, lastSaleDate: "2026-09-20" } } } })).toEqual([]);
    expect(parseEbaySales({ ebay: { salesByGrade: { psa10: { count: 3, averagePrice: null, lastSaleDate: "2026-09-20" } } } })).toEqual([]);
    expect(parseEbaySales({ ebay: { salesByGrade: { psa10: { count: 3, averagePrice: 100, lastSaleDate: null } } } })).toEqual([]);
  });
});
