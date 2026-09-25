import { describe, expect, it } from "vitest";
import {
  totalWeight,
  weightedMean,
  weightedMedian,
  weightedPercentile,
  weightedStddev,
  type PriceObservation,
} from "./stats";
import { computeMarketSignals } from "./signals";
import { computePriceGuide, defaultSellCosts } from "./pricing";
import { makeComp, NOW } from "./__fixtures__/comps";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS).toISOString();

/** Expands weighted observations into individual weight-1 sales. */
function expand(obs: PriceObservation[]): PriceObservation[] {
  return obs.flatMap((o) => Array.from({ length: o.weight ?? 1 }, () => ({ soldAt: o.soldAt, priceCents: o.priceCents })));
}

const daily: PriceObservation[] = [
  { soldAt: daysAgo(2), priceCents: 10000, weight: 3 },
  { soldAt: daysAgo(5), priceCents: 12000, weight: 1 },
  { soldAt: daysAgo(9), priceCents: 9000, weight: 4 },
];

describe("weighted statistics", () => {
  it("returns null for no observations", () => {
    expect(weightedMedian([])).toBeNull();
    expect(weightedMean([])).toBeNull();
    expect(weightedStddev([])).toBeNull();
  });

  it("treats weight w exactly like w identical sales", () => {
    const flat = expand(daily);
    expect(totalWeight(daily)).toBe(8);
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(weightedPercentile(daily, p)).toBe(weightedPercentile(flat, p));
    }
    expect(weightedMean(daily)).toBeCloseTo(weightedMean(flat)!, 6);
    expect(weightedStddev(daily)).toBeCloseTo(weightedStddev(flat)!, 6);
  });

  it("interpolates between the two middle sales for an even count", () => {
    const two = [
      { soldAt: daysAgo(1), priceCents: 100 },
      { soldAt: daysAgo(1), priceCents: 201 },
    ];
    expect(weightedMedian(two)).toBe(151); // round(150.5)
  });

  it("a heavy day dominates the median", () => {
    const obs = [
      { soldAt: daysAgo(1), priceCents: 5000, weight: 9 },
      { soldAt: daysAgo(2), priceCents: 90000, weight: 1 },
    ];
    expect(weightedMedian(obs)).toBe(5000);
  });

  it("stddev is null below 2 sales, even with one observation", () => {
    expect(weightedStddev([{ soldAt: daysAgo(1), priceCents: 100, weight: 1 }])).toBeNull();
    expect(weightedStddev([{ soldAt: daysAgo(1), priceCents: 100, weight: 2 }])).toBe(0);
  });
});

describe("analysis on daily summaries", () => {
  it("counts sales, not days, for velocity and sample size", () => {
    const s = computeMarketSignals("c1", "psa10", daily, NOW);
    expect(s.salesTotal).toBe(8);
    expect(s.salesPerWeek).toBe(4); // days 2 and 5
    const guide = computePriceGuide(daily, defaultSellCosts("psa10"), [0], NOW)!;
    expect(guide.sampleSize).toBe(8);
    expect(guide.marketPriceCents).toBe(weightedMedian(expand(daily)));
  });
});

describe("trend robustness", () => {
  it("is null when a window has fewer than 2 sales", () => {
    const comps = [
      makeComp({ priceCents: 9750, soldAt: daysAgo(20) }),
      makeComp({ priceCents: 24000, soldAt: daysAgo(42) }), // lone outlier in the prior window
    ];
    expect(computeMarketSignals("c1", "psa10", comps, NOW).priceTrendPct).toBeNull();
  });

  it("uses medians, so one outlier in a window doesn't swing it", () => {
    const comps = [
      ...[10000, 10100, 10200].map((p, i) => makeComp({ priceCents: p, soldAt: daysAgo(5 + i) })),
      ...[10000, 10100, 90000].map((p, i) => makeComp({ priceCents: p, soldAt: daysAgo(40 + i) })),
    ];
    const trend = computeMarketSignals("c1", "raw", comps, NOW).priceTrendPct!;
    expect(Math.abs(trend)).toBeLessThan(2);
  });
});
