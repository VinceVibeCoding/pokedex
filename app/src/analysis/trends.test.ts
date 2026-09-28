import { describe, expect, it } from "vitest";
import { computeTrendSignals, eraOf, pctChange, segmentHeadline } from "./trends";

const base = { priceCents: 5000, own7dCents: null, own30dCents: null, cm: null, salesPerWeek: null };

describe("pctChange", () => {
  it("handles missing and zero baselines", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(null, 100)).toBeNull();
    expect(pctChange(100, 0)).toBeNull();
  });
});

describe("computeTrendSignals", () => {
  it("flags trending from our own 7-day history first", () => {
    const s = computeTrendSignals({ ...base, own7dCents: 4000, cm: { avg1: 10, avg7: 10, avg30: 10 } });
    expect(s.tags).toContain("trending");
    expect(s.trendSource).toBe("own");
    expect(s.reasons[0]).toMatch(/\+25\.0% in the last 7 days/);
  });
  it("falls back to Cardmarket momentum when we have no history", () => {
    const s = computeTrendSignals({ ...base, cm: { avg1: 120, avg7: 120, avg30: 100 } });
    expect(s.trendSource).toBe("cardmarket");
    expect(s.tags).toContain("trending");
  });
  it("flags undervalued only for a moderate dip that isn't a collapse or a glitch", () => {
    expect(computeTrendSignals({ ...base, cm: { avg1: 85, avg7: 95, avg30: 100 } }).tags).toContain("undervalued");
    expect(computeTrendSignals({ ...base, cm: { avg1: 40, avg7: 90, avg30: 100 } }).tags).not.toContain("undervalued"); // -60%: glitch
    expect(computeTrendSignals({ ...base, cm: { avg1: 85, avg7: 70, avg30: 100 } }).tags).not.toContain("undervalued"); // still sliding
  });
  it("ignores cheap cards and stale Cardmarket data", () => {
    expect(computeTrendSignals({ ...base, priceCents: 100, own7dCents: 50 }).tags).toEqual([]);
    expect(computeTrendSignals({ ...base, cm: null }).trendPct).toBeNull();
  });
  it("flags volume only when sold-listing data shows it", () => {
    expect(computeTrendSignals({ ...base, salesPerWeek: 8 }).tags).toContain("volume");
    expect(computeTrendSignals({ ...base, salesPerWeek: null }).tags).not.toContain("volume");
  });
});

describe("eraOf / segmentHeadline", () => {
  it("buckets by release year", () => {
    expect(eraOf(1999)).toMatch(/Wizards/);
    expect(eraOf(2016)).toMatch(/XY/);
    expect(eraOf(2025)).toMatch(/Scarlet/);
  });
  it("writes a plain-language headline, and nothing when there is no change data", () => {
    expect(segmentHeadline({ label: "Jungle", cards: 60, changePct: 8.24, pctUp: 62.4, window: "30d" })).toBe("Jungle up 8.2% over 30 days across 60 cards, 62% of cards rising");
    expect(segmentHeadline({ label: "Jungle", cards: 60, changePct: null, pctUp: null, window: "30d" })).toBeNull();
  });
});
