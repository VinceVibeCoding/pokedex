// Price guide — what a card is worth at one grade tier, and the most you can pay
// for it and still make a target return when you resell.
//
// Market price: median of the trailing-30d sales (median, not mean, so one huge
// outlier sale doesn't skew it). If there were no sales in 30d, falls back to the
// trailing 90d and says so via `basis`. Typical range = 25th–75th percentile of
// the same window.
//
// Max buy price for a target ROI (return on what you paid):
//   net     = market × (1 − feePct) − fixedFee − shipping
//   maxBuy  = net / (1 + targetRoi)
// targetRoi 0% is break-even. Clamped at 0 when fees eat the whole sale.
//
// Fee assumptions (eBay trading-card category, 2026): 13.25% final value fee +
// $0.40 per order. Shipping: $1 for raw (plain envelope), $5 for graded slabs
// (tracked bubble mailer). All overridable via SellCosts.
//
// Input is price observations (stats.ts): individual sales or weighted daily
// summaries; sampleSize counts sales, not observations.
// Returns null when there are no sales in the 90d window.

import type { GradeTier, PriceGuide } from "../types/domain";
import { totalWeight, weightedPercentile, within, type PriceObservation } from "./stats";

export interface SellCosts {
  feePct: number;
  fixedFeeCents: number;
  shippingCents: number;
}

export const DEFAULT_TARGET_ROI_PCT = [0, 10, 20, 30];

export function defaultSellCosts(gradeTier: GradeTier): SellCosts {
  return {
    feePct: 13.25,
    fixedFeeCents: 40,
    shippingCents: gradeTier === "raw" ? 100 : 500,
  };
}

/** What you pocket from a sale at `priceCents` after fees and shipping. */
export function netAfterFees(priceCents: number, costs: SellCosts): number {
  return Math.round(priceCents * (1 - costs.feePct / 100) - costs.fixedFeeCents - costs.shippingCents);
}

/** Most you can pay and still earn `targetRoiPct` reselling at `marketCents`. */
export function maxBuyPrice(marketCents: number, targetRoiPct: number, costs: SellCosts): number {
  return Math.max(0, Math.round(netAfterFees(marketCents, costs) / (1 + targetRoiPct / 100)));
}

export function computePriceGuide(
  observations: PriceObservation[],
  costs: SellCosts,
  targetRoisPct: number[] = DEFAULT_TARGET_ROI_PCT,
  now: Date = new Date(),
): PriceGuide | null {
  let basis: PriceGuide["basis"] = "30d";
  let window = within(observations, now, 30);
  if (totalWeight(window) === 0) {
    basis = "90d";
    window = within(observations, now, 90);
  }
  if (totalWeight(window) === 0) return null;

  const marketPriceCents = weightedPercentile(window, 0.5)!;
  return {
    marketPriceCents,
    basis,
    sampleSize: totalWeight(window),
    typicalLowCents: weightedPercentile(window, 0.25)!,
    typicalHighCents: weightedPercentile(window, 0.75)!,
    netAfterFeesCents: netAfterFees(marketPriceCents, costs),
    maxBuyPrices: targetRoisPct.map((targetRoiPct) => ({
      targetRoiPct,
      priceCents: maxBuyPrice(marketPriceCents, targetRoiPct, costs),
    })),
  };
}
