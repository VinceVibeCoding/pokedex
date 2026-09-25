import { describe, expect, it } from "vitest";
import { computeGradePremium } from "./gradePremium";
import type { Comp, GradeTier } from "../types/domain";
import { liquidComps, makeComp, NOW } from "./__fixtures__/comps";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS).toISOString();

function tieredComps(): Map<GradeTier, Comp[]> {
  const map = new Map<GradeTier, Comp[]>();
  map.set("raw", liquidComps("c1", "raw")); // median ~$110 → baseline ~$135 with grading cost
  // PSA 9 priced BELOW the raw+grading baseline → better value than raw → recommended
  map.set("psa9", [
    makeComp({ cardId: "c1", gradeTier: "psa9", priceCents: 12800, soldAt: daysAgo(5) }),
    makeComp({ cardId: "c1", gradeTier: "psa9", priceCents: 13200, soldAt: daysAgo(12) }),
  ]);
  // PSA 10 at 20x raw → poor value
  map.set("psa10", [
    makeComp({ cardId: "c1", gradeTier: "psa10", priceCents: 220000, soldAt: daysAgo(8) }),
  ]);
  // PSA 8: sparse → null tier
  map.set("psa8", []);
  return map;
}

describe("computeGradePremium", () => {
  it("returns null when even raw has no data", () => {
    expect(computeGradePremium("c1", new Map(), 2500, NOW)).toBeNull();
  });

  it("recommends the tier with the best value vs raw+grading baseline", () => {
    const result = computeGradePremium("c1", tieredComps(), 2500, NOW)!;
    expect(result.recommendedTier).toBe("psa9");
    const psa8 = result.tiers.find((t) => t.gradeTier === "psa8")!;
    expect(psa8.marketPriceCents).toBeNull(); // insufficient data is valid
    const psa10 = result.tiers.find((t) => t.gradeTier === "psa10")!;
    expect(psa10.premiumOverRawPct!).toBeGreaterThan(500);
  });
});
