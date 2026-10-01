import { describe, expect, it } from "vitest";
import { describeTrackStats, summarizeFlagReturns } from "./trackRecord";

const base = new Map([["2026-10-01", 2], ["2026-10-02", 4]]);

describe("summarizeFlagReturns", () => {
  it("computes median, average, share up and the excess over the baseline", () => {
    const s = summarizeFlagReturns(
      [
        { date: "2026-10-01", returnPct: 10 },
        { date: "2026-10-01", returnPct: -4 },
        { date: "2026-10-02", returnPct: 6 },
      ],
      base,
    );
    expect(s.n).toBe(3);
    expect(s.medianPct).toBe(6);
    expect(s.avgPct).toBeCloseTo(4);
    expect(s.pctUp).toBeCloseTo(66.67, 1);
    expect(s.baselinePct).toBeCloseTo((2 + 2 + 4) / 3); // weighted by how many flags each date has
    expect(s.excessPct).toBeCloseTo(6 - 8 / 3);
  });
  it("handles an even count, missing baselines, non-finite values and no data", () => {
    expect(summarizeFlagReturns([{ date: "x", returnPct: 2 }, { date: "x", returnPct: 4 }], new Map()).medianPct).toBe(3);
    expect(summarizeFlagReturns([{ date: "x", returnPct: 2 }], new Map()).excessPct).toBeNull();
    expect(summarizeFlagReturns([{ date: "x", returnPct: NaN }], base).n).toBe(0);
    expect(summarizeFlagReturns([], base).medianPct).toBeNull();
  });
});

describe("describeTrackStats", () => {
  it("says so when nothing is old enough, and hedges small samples", () => {
    expect(describeTrackStats("trending", 7, summarizeFlagReturns([], base))).toBe("No trending flags are 7 days old yet.");
    const text = describeTrackStats("trending", 7, summarizeFlagReturns([{ date: "2026-10-01", returnPct: 10 }], base));
    expect(text).toContain("median +10.0% after 7 days");
    expect(text).toContain("ahead of the typical card (+2.0%) by 8.0 points");
    expect(text).toContain("Only 1 flags so far");
  });
  it("does not hedge a large sample", () => {
    const many = Array.from({ length: 25 }, () => ({ date: "2026-10-01", returnPct: -3 }));
    const text = describeTrackStats("undervalued", 30, summarizeFlagReturns(many, base));
    expect(text).toContain("behind the typical card");
    expect(text).not.toContain("too few");
  });
});
