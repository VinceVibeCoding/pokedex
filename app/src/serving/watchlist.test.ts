import { describe, expect, it } from "vitest";
import { computeHoldingPl } from "./watchlist";

describe("computeHoldingPl", () => {
  it("computes value, cost, P&L and P&L% for a known cost basis", () => {
    // Bought 2 @ $10, now worth $15 each: value $30, cost $20, +$10, +50%
    const pl = computeHoldingPl({ quantity: 2, acquiredPriceCents: 1000, currentPriceCents: 1500 });
    expect(pl).toEqual({ valueCents: 3000, costCents: 2000, plCents: 1000, plPct: 50 });
  });

  it("a loss is negative P&L and P&L%", () => {
    const pl = computeHoldingPl({ quantity: 1, acquiredPriceCents: 2000, currentPriceCents: 1500 });
    expect(pl.plCents).toBe(-500);
    expect(pl.plPct).toBe(-25);
  });

  it("no cost basis means P&L is unknown even with a current price", () => {
    const pl = computeHoldingPl({ quantity: 1, acquiredPriceCents: null, currentPriceCents: 1500 });
    expect(pl.valueCents).toBe(1500);
    expect(pl.costCents).toBeNull();
    expect(pl.plCents).toBeNull();
    expect(pl.plPct).toBeNull();
  });

  it("no current price (no recent sales) means value and P&L are unknown", () => {
    const pl = computeHoldingPl({ quantity: 1, acquiredPriceCents: 1000, currentPriceCents: null });
    expect(pl.valueCents).toBeNull();
    expect(pl.costCents).toBe(1000);
    expect(pl.plCents).toBeNull();
  });

  it("quantity multiplies both sides", () => {
    const pl = computeHoldingPl({ quantity: 3, acquiredPriceCents: 500, currentPriceCents: 700 });
    expect(pl.costCents).toBe(1500);
    expect(pl.valueCents).toBe(2100);
    expect(pl.plCents).toBe(600);
  });
});
