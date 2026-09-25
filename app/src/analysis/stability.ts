// Market Stability Index — composite 0–100 from volume + recency + volatility.
// Higher = more stable/liquid market (more sales, recent activity, low price swings).
//
// Formula (weights: volume 40%, recency 30%, volatility 30%):
//   volume     = min(salesPerWeek / 5, 1) * 100        — 5+ sales/week = fully liquid
//   recency    = max(0, 1 - daysSinceLastSale / 30) * 100 — decays to 0 after 30 days
//   volatility = max(0, 1 - cv / 0.5) * 100             — CV >= 50% = fully unstable
//
// Returns null when there are zero comps ("insufficient data" is a valid state).

import type { MarketSignals, MarketStabilityIndex } from "../types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeStabilityIndex(
  signals: MarketSignals,
  now: Date = new Date(),
): MarketStabilityIndex | null {
  if (signals.salesTotal === 0 || signals.lastSaleAt === null) return null;

  const daysSinceLastSale =
    (now.getTime() - new Date(signals.lastSaleAt).getTime()) / DAY_MS;

  const volumeComponent = Math.min(signals.salesPerWeek / 5, 1) * 100;
  const recencyComponent = Math.max(0, 1 - daysSinceLastSale / 30) * 100;
  // With a single sale there is no measurable spread — treat as neutral, not perfect.
  const volatilityComponent =
    signals.volatility === null ? 50 : Math.max(0, 1 - signals.volatility / 0.5) * 100;

  const score =
    0.4 * volumeComponent + 0.3 * recencyComponent + 0.3 * volatilityComponent;

  return {
    score: Math.round(score * 10) / 10,
    volumeComponent: Math.round(volumeComponent * 10) / 10,
    recencyComponent: Math.round(recencyComponent * 10) / 10,
    volatilityComponent: Math.round(volatilityComponent * 10) / 10,
  };
}
