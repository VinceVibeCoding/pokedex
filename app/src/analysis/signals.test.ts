import { describe, expect, it } from "vitest";
import { computeMarketSignals } from "./signals";
import { liquidComps, makeComp, NOW, singleComp, staleComps } from "./__fixtures__/comps";

describe("computeMarketSignals", () => {
  it("returns zeroes and nulls for zero comps", () => {
    const s = computeMarketSignals("c1", "raw", [], NOW);
    expect(s.salesTotal).toBe(0);
    expect(s.salesPerWeek).toBe(0);
    expect(s.lastSaleAt).toBeNull();
    expect(s.lastSalePriceCents).toBeNull();
    expect(s.priceTrendPct).toBeNull();
    expect(s.volatility).toBeNull();
  });

  it("handles a single comp — no trend, no volatility", () => {
    const s = computeMarketSignals("c1", "raw", singleComp(), NOW);
    expect(s.salesTotal).toBe(1);
    expect(s.lastSalePriceCents).toBe(450);
    expect(s.priceTrendPct).toBeNull();
    expect(s.volatility).toBeNull();
  });

  it("computes velocities and last sale for a liquid market", () => {
    const comps = liquidComps();
    const s = computeMarketSignals("c1", "raw", comps, NOW);
    expect(s.salesTotal).toBe(24);
    expect(s.salesPerWeek).toBeGreaterThanOrEqual(2);
    expect(s.lastSalePriceCents).toBe(comps[comps.length - 1].priceCents);
    expect(s.priceTrendPct).not.toBeNull();
    expect(s.priceTrendPct!).toBeGreaterThan(0); // rising fixture
    expect(s.volatility).not.toBeNull();
    expect(s.volatility!).toBeLessThan(0.2); // steady fixture
  });

  it("returns null trend/volatility for a stale market (no recent sales)", () => {
    const s = computeMarketSignals("c1", "raw", staleComps(), NOW);
    expect(s.salesTotal).toBe(10);
    expect(s.salesPerWeek).toBe(0);
    expect(s.priceTrendPct).toBeNull();
    expect(s.volatility).toBeNull();
  });

  it("never mixes grade tiers — caller-filtered comps stay as passed", () => {
    const comps = [
      makeComp({ priceCents: 1000, soldAt: NOW.toISOString(), gradeTier: "psa9" }),
    ];
    const s = computeMarketSignals("c1", "psa9", comps, NOW);
    expect(s.gradeTier).toBe("psa9");
    expect(s.salesTotal).toBe(1);
  });
});
