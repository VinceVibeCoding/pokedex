import { describe, expect, it } from "vitest";
import { chooseSeries, type DailyRow } from "./series";
import { makeComp, NOW } from "../analysis/__fixtures__/comps";

const day = (n: number) => new Date(Date.UTC(2026, 8, 21 - n));
const row = (overrides: Partial<DailyRow> & Pick<DailyRow, "source" | "saleCount">): DailyRow => ({
  date: day(1),
  avgPriceCents: 10000,
  medianPriceCents: null,
  ...overrides,
});

describe("chooseSeries", () => {
  it("returns null with no data", () => {
    expect(chooseSeries([], [])).toBeNull();
  });

  it("ignores days with a price but no sales", () => {
    expect(chooseSeries([], [row({ source: "poketrace_ebay", saleCount: 0 })])).toBeNull();
  });

  it("prefers individual sales over daily summaries", () => {
    const comps = [makeComp({ priceCents: 500, soldAt: NOW.toISOString() })];
    const series = chooseSeries(comps, [row({ source: "ppt_ebay", saleCount: 30 })])!;
    expect(series.basis.kind).toBe("sales");
    expect(series.dailySales).toEqual([]);
  });

  it("picks the daily source with the most sales and never mixes sources", () => {
    const series = chooseSeries(
      [],
      [
        row({ source: "poketrace_tcgplayer", saleCount: 2, date: day(1) }),
        row({ source: "poketrace_ebay", saleCount: 3, date: day(1) }),
        row({ source: "poketrace_ebay", saleCount: 4, date: day(2) }),
      ],
    )!;
    expect(series.basis.label).toContain("eBay");
    expect(series.observations).toHaveLength(2);
    expect(series.observations.map((o) => o.weight)).toEqual([3, 4]); // newest first
  });

  it("breaks ties by source preference", () => {
    const series = chooseSeries(
      [],
      [row({ source: "poketrace_tcgplayer", saleCount: 5 }), row({ source: "poketrace_ebay", saleCount: 5 })],
    )!;
    expect(series.basis.label).toBe("eBay daily sales · PokeTrace");
  });

  it("places each day at noon UTC and uses the median when a source has one", () => {
    const series = chooseSeries([], [row({ source: "ppt_ebay", saleCount: 1, medianPriceCents: 9000, date: day(3) })])!;
    expect(series.observations[0]).toEqual({ soldAt: "2026-09-18T12:00:00.000Z", priceCents: 9000, weight: 1 });
    expect(series.dailySales[0]).toEqual({ date: "2026-09-18", avgPriceCents: 9000, saleCount: 1 });
  });
});
