import { describe, expect, it } from "vitest";
import { computeMarketSignals } from "./signals";
import { computeBuyScore } from "./buyScore";
import { liquidComps, NOW, singleComp, staleComps } from "./__fixtures__/comps";

describe("computeBuyScore", () => {
  it("returns null for zero comps", () => {
    const signals = computeMarketSignals("c1", "raw", [], NOW);
    expect(computeBuyScore(signals, [], NOW)).toBeNull();
  });

  it("rates a rising liquid market as buy or better, with reasons", () => {
    const comps = liquidComps();
    const signals = computeMarketSignals("c1", "raw", comps, NOW);
    const score = computeBuyScore(signals, comps, NOW)!;
    expect(score.score).toBeGreaterThanOrEqual(55);
    expect(["buy", "strong_buy"]).toContain(score.verdict);
    expect(score.reasons.length).toBeGreaterThanOrEqual(3);
    expect(score.reasons.join(" ")).toContain("trend");
  });

  it("is explainable for a single comp (no trend, low liquidity)", () => {
    const comps = singleComp();
    const signals = computeMarketSignals("c1", "raw", comps, NOW);
    const score = computeBuyScore(signals, comps, NOW)!;
    expect(score.reasons.join(" ")).toContain("Not enough history");
    expect(score.verdict).toBe("hold");
  });

  it("penalizes a stale, history-only market", () => {
    const comps = staleComps();
    const signals = computeMarketSignals("c1", "raw", comps, NOW);
    const score = computeBuyScore(signals, comps, NOW)!;
    expect(score.score).toBeLessThanOrEqual(50);
    expect(["hold", "avoid"]).toContain(score.verdict);
  });
});
