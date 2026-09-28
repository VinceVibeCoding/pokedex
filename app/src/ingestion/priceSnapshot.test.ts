import { describe, expect, it } from "vitest";
import { isFresh, pickTcgPrice, toSnapshotRow } from "./priceSnapshot";

describe("pickTcgPrice", () => {
  it("prefers the base printing over 1st Edition", () => {
    expect(pickTcgPrice({ "1stEdition": { market: 78.82, low: 58.99 }, unlimited: { market: 24.06, low: 11.83 } })).toEqual({ variant: "unlimited", market: 24.06, low: 11.83 });
  });
  it("falls back to 1st Edition, skips variants with no market, and handles nothing", () => {
    expect(pickTcgPrice({ "1stEdition": { market: 78 } })?.variant).toBe("1stEdition");
    expect(pickTcgPrice({ normal: { market: null }, holofoil: { market: 5 } })?.variant).toBe("holofoil");
    expect(pickTcgPrice(null)).toBeNull();
    expect(pickTcgPrice({})).toBeNull();
  });
});

describe("toSnapshotRow", () => {
  it("converts to cents and normalizes the Cardmarket date", () => {
    const row = toSnapshotRow({
      id: "base2-27",
      tcgplayer: { prices: { unlimited: { market: 24.06, low: 11.83 } } },
      cardmarket: { updatedAt: "2026/07/01", prices: { trendPrice: 13.19, avg1: 8.83, avg7: 16.72, avg30: 13.96 } },
    });
    expect(row).toEqual({
      cardId: "base2-27", tcgVariant: "unlimited", tcgMarketCents: 2406, tcgLowCents: 1183,
      cmTrendCents: 1319, cmAvg1Cents: 883, cmAvg7Cents: 1672, cmAvg30Cents: 1396, cmUpdatedAt: "2026-07-01",
    });
  });
  it("drops cards under the storage floor and cards with no price", () => {
    expect(toSnapshotRow({ id: "x", tcgplayer: { prices: { normal: { market: 0.25 } } } })).toBeNull();
    expect(toSnapshotRow({ id: "y" })).toBeNull();
  });
});

describe("isFresh", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("treats week-old and missing Cardmarket data as stale", () => {
    expect(isFresh("2026-09-27", now)).toBe(true);
    expect(isFresh("2026-09-20", now)).toBe(false);
    expect(isFresh("2026-07-01", now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
});
