import { describe, expect, it } from "vitest";
import {
  computePriceGuide,
  defaultSellCosts,
  maxBuyPrice,
  netAfterFees,
  type SellCosts,
} from "./pricing";
import { liquidComps, makeComp, NOW, outlierComps, singleComp, staleComps } from "./__fixtures__/comps";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS).toISOString();
const RAW = defaultSellCosts("raw");
const NO_COSTS: SellCosts = { feePct: 0, fixedFeeCents: 0, shippingCents: 0 };

describe("netAfterFees / maxBuyPrice", () => {
  it("deducts percentage fee, fixed fee and shipping", () => {
    // $100 sale: 100 − 13.25 − 0.40 − 1.00 = $85.35
    expect(netAfterFees(10000, RAW)).toBe(8535);
  });

  it("break-even (0% ROI) equals the net proceeds", () => {
    expect(maxBuyPrice(10000, 0, RAW)).toBe(8535);
  });

  it("higher target ROI lowers the max buy price", () => {
    // 8535 / 1.2 = 7112.5 → 7113
    expect(maxBuyPrice(10000, 20, RAW)).toBe(7113);
    expect(maxBuyPrice(10000, 30, RAW)).toBeLessThan(maxBuyPrice(10000, 20, RAW));
  });

  it("clamps at 0 when fees exceed the sale price", () => {
    expect(maxBuyPrice(100, 0, defaultSellCosts("psa10"))).toBe(0);
  });

  it("graded tiers assume more expensive shipping than raw", () => {
    expect(defaultSellCosts("psa10").shippingCents).toBeGreaterThan(RAW.shippingCents);
  });
});

describe("computePriceGuide", () => {
  it("returns null with no comps", () => {
    expect(computePriceGuide([], RAW, [0], NOW)).toBeNull();
  });

  it("returns null when the last sale is older than 90 days", () => {
    expect(computePriceGuide(staleComps(), RAW, [0], NOW)).toBeNull();
  });

  it("uses the trailing-30d median as market price", () => {
    const guide = computePriceGuide(liquidComps(), NO_COSTS, [0], NOW)!;
    expect(guide.basis).toBe("30d");
    expect(guide.typicalLowCents).toBeLessThanOrEqual(guide.marketPriceCents);
    expect(guide.typicalHighCents).toBeGreaterThanOrEqual(guide.marketPriceCents);
    expect(guide.maxBuyPrices[0].priceCents).toBe(guide.marketPriceCents);
  });

  it("falls back to 90d when there were no sales in the last 30d", () => {
    const comps = [
      makeComp({ priceCents: 1000, soldAt: daysAgo(40) }),
      makeComp({ priceCents: 2000, soldAt: daysAgo(50) }),
      makeComp({ priceCents: 3000, soldAt: daysAgo(60) }),
    ];
    const guide = computePriceGuide(comps, NO_COSTS, [0], NOW)!;
    expect(guide.basis).toBe("90d");
    expect(guide.sampleSize).toBe(3);
    expect(guide.marketPriceCents).toBe(2000);
  });

  it("uses the median so a huge outlier does not skew the market price", () => {
    const base = computePriceGuide(liquidComps(), RAW, [0], NOW)!.marketPriceCents;
    const withOutlier = computePriceGuide(outlierComps(), RAW, [0], NOW)!.marketPriceCents;
    // Median of 13 vs 14 values in the window — shifts by at most one step, never near the 10x outlier.
    expect(Math.abs(withOutlier - base)).toBeLessThan(base * 0.05);
  });

  it("works with a single comp", () => {
    const guide = computePriceGuide(singleComp(), RAW, [0, 20], NOW)!;
    expect(guide.marketPriceCents).toBe(450);
    expect(guide.typicalLowCents).toBe(450);
    expect(guide.sampleSize).toBe(1);
    expect(guide.maxBuyPrices).toHaveLength(2);
  });
});
