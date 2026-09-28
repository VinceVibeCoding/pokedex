import { describe, expect, it } from "vitest";
import { weightedAvg } from "./movers";

describe("weightedAvg", () => {
  it("returns null for an empty window", () => {
    expect(weightedAvg([])).toBeNull();
  });

  it("weights each day by its sale count, not a plain average", () => {
    // A $100 day with 1 sale and a $200 day with 3 sales should skew toward $200.
    const avg = weightedAvg([
      { avgPriceCents: 10000, saleCount: 1 },
      { avgPriceCents: 20000, saleCount: 3 },
    ]);
    // (10000*1 + 20000*3) / 4 = 17500
    expect(avg).toBe(17500);
  });

  it("treats a 0-sale day (price quoted, nothing sold) as weight 1, not 0", () => {
    const avg = weightedAvg([{ avgPriceCents: 10000, saleCount: 0 }]);
    expect(avg).toBe(10000);
  });

  it("a single day returns its own average", () => {
    expect(weightedAvg([{ avgPriceCents: 5000, saleCount: 2 }])).toBe(5000);
  });
});
