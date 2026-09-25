import { describe, expect, it } from "vitest";
import { parseGradeInput } from "./grade";

describe("parseGradeInput", () => {
  it.each([
    ["", "raw"],
    ["raw", "raw"],
    ["NM", "raw"],
    ["10", "psa10"],
    ["PSA 9", "psa9"],
    ["psa8", "psa8"],
    ["gem mint 10", "psa10"],
  ])("%s → %s with no note", (input, tier) => {
    expect(parseGradeInput(input)).toEqual({ ok: true, tier, note: null });
  });

  it("maps other graders to the same PSA number, with a note", () => {
    const parsed = parseGradeInput("CGC 10");
    expect(parsed).toMatchObject({ ok: true, tier: "psa10" });
    expect(parsed.note).toMatch(/CGC shown as PSA 10/);
  });

  it("rounds half grades down, with a note", () => {
    const parsed = parseGradeInput("BGS 9.5");
    expect(parsed).toMatchObject({ ok: true, tier: "psa9" });
    expect(parsed.note).toMatch(/rounded down to 9/);
  });

  it("rejects grades below 8 as untracked", () => {
    expect(parseGradeInput("psa 7")).toMatchObject({ ok: false });
  });

  it("rejects unreadable text", () => {
    expect(parseGradeInput("shiny")).toMatchObject({ ok: false });
  });
});
