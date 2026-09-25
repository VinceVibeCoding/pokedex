import { describe, expect, it } from "vitest";
import { detectGradeTier, normalizeCondition } from "./gradeDetect";

describe("detectGradeTier", () => {
  it.each([
    ["Charizard PSA 10 Base Set", "psa10"],
    ["psa 9 mint", "psa9"],
    ["PSA 8 NM-MT", "psa8"],
    ["GEM MINT 10!", "psa10"],
  ] as const)("detects %s as %s", (text, tier) => {
    expect(detectGradeTier(text)).toBe(tier);
  });

  it.each(["Near Mint", "NM", "LP played", "ungraded"])(
    "treats ungraded text %s as raw",
    (text) => {
      expect(detectGradeTier(text)).toBe("raw");
    },
  );

  it("returns null when there is nothing to classify", () => {
    expect(detectGradeTier(null)).toBeNull();
  });
});

describe("normalizeCondition", () => {
  it("keeps condition text for raw comps", () => {
    expect(normalizeCondition("NM")).toEqual({ gradeTier: "raw", condition: "NM" });
  });

  it("clears condition for graded comps — grade IS the condition", () => {
    expect(normalizeCondition("PSA 9")).toEqual({ gradeTier: "psa9", condition: null });
  });

  it("defaults to raw with null condition when no text exists", () => {
    expect(normalizeCondition(null)).toEqual({ gradeTier: "raw", condition: null });
  });
});
