import { describe, expect, it } from "vitest";
import { computeMarketSignals } from "./signals";
import { computeStabilityIndex } from "./stability";
import { liquidComps, NOW, singleComp, staleComps } from "./__fixtures__/comps";

describe("computeStabilityIndex", () => {
  it("returns null for zero comps", () => {
    const signals = computeMarketSignals("c1", "raw", [], NOW);
    expect(computeStabilityIndex(signals, NOW)).toBeNull();
  });

  it("scores a liquid, recent, low-volatility market high", () => {
    const signals = computeMarketSignals("c1", "raw", liquidComps(), NOW);
    const idx = computeStabilityIndex(signals, NOW)!;
    expect(idx.score).toBeGreaterThan(60);
    // Fixture spacing puts 2 sales in the trailing 7d window → 2/5 * 100 = 40.
    expect(idx.volumeComponent).toBeGreaterThanOrEqual(40);
    expect(idx.recencyComponent).toBeGreaterThan(90); // last sale today
  });

  it("scores a stale market low on recency", () => {
    const signals = computeMarketSignals("c1", "raw", staleComps(), NOW);
    const idx = computeStabilityIndex(signals, NOW)!;
    expect(idx.recencyComponent).toBe(0); // 200 days since last sale
    expect(idx.score).toBeLessThan(35);
  });

  it("treats a single sale as neutral volatility, not perfect", () => {
    const signals = computeMarketSignals("c1", "raw", singleComp(), NOW);
    const idx = computeStabilityIndex(signals, NOW)!;
    expect(idx.volatilityComponent).toBe(50);
  });
});
