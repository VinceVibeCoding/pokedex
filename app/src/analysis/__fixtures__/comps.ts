// Shared test fixtures — mirror the seeded edge cases:
// zero sales, single sale, huge outlier, stale last sale, sparse grade tiers.

import type { Comp, GradeTier } from "../../types/domain";

export const NOW = new Date("2026-09-21T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS).toISOString();

let seq = 0;
export function makeComp(
  overrides: Partial<Comp> & { priceCents: number; soldAt: string },
): Comp {
  seq += 1;
  return {
    id: `comp-${seq}`,
    cardId: "test-card",
    gradeTier: "raw",
    currency: "USD",
    condition: null,
    source: "tcgplayer",
    sourceUrl: null,
    ...overrides,
  };
}

/** Steady liquid market: 3 sales/week for 8 weeks, rising 100→120. */
export function liquidComps(cardId = "test-card", gradeTier: GradeTier = "raw"): Comp[] {
  const comps: Comp[] = [];
  for (let i = 0; i < 24; i++) {
    comps.push(
      makeComp({
        cardId,
        gradeTier,
        priceCents: 10000 + i * 87, // ~+21% over 8 weeks
        soldAt: daysAgo(56 - i * 2.33),
      }),
    );
  }
  return comps;
}

/** One sale, 6 days ago. */
export function singleComp(cardId = "test-card"): Comp[] {
  return [makeComp({ cardId, priceCents: 450, soldAt: daysAgo(6) })];
}

/** Normal sales plus one 10x outlier in the last 30 days. */
export function outlierComps(cardId = "test-card"): Comp[] {
  const comps = liquidComps(cardId);
  comps.push(makeComp({ cardId, priceCents: 120000, soldAt: daysAgo(3) }));
  return comps;
}

/** 10 sales, newest is 200 days old. */
export function staleComps(cardId = "test-card"): Comp[] {
  const comps: Comp[] = [];
  for (let i = 0; i < 10; i++) {
    comps.push(
      makeComp({
        cardId,
        priceCents: 9000 + i * 100,
        soldAt: daysAgo(300 - i * 10),
      }),
    );
  }
  return comps;
}
