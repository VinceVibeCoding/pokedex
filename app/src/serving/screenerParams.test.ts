import { describe, expect, it } from "vitest";
import { canonicalQuery, describeQuery, parseScreenerParams, paramsFromQuery } from "./screenerParams";

describe("parseScreenerParams", () => {
  it("parses filters, converts dollars to cents, and ignores unknown values", () => {
    expect(parseScreenerParams({ tag: "trending", set: "Jungle", min: "5", max: "50.5", sort: "dip", q: " snorlax " })).toMatchObject({
      tag: "trending", set: "Jungle", minCents: 500, maxCents: 5050, sort: "dip", q: "snorlax",
    });
    expect(parseScreenerParams({ tag: "bogus", sort: "nope", min: "abc", max: "-3" })).toMatchObject({ tag: null, sort: "trend", minCents: null, maxCents: null });
  });
  it("takes the first value of a repeated parameter", () => {
    expect(parseScreenerParams({ tag: ["undervalued", "trending"] }).tag).toBe("undervalued");
  });
});

describe("canonicalQuery", () => {
  it("keeps only known, non-default filters in a stable order and drops the page", () => {
    expect(canonicalQuery({ page: "3", sort: "trend", set: "Jungle", tag: "trending", junk: "x" })).toBe("tag=trending&set=Jungle");
    expect(canonicalQuery({})).toBe("");
  });
  it("round-trips", () => {
    const q = canonicalQuery({ q: "mew", tag: "undervalued", sort: "dip", min: "10" });
    expect(canonicalQuery(paramsFromQuery(q))).toBe(q);
  });
  it("drops an unparseable price bound", () => {
    expect(canonicalQuery({ min: "abc", max: "20" })).toBe("max=20");
  });
});

describe("describeQuery", () => {
  it("names a filter in plain words", () => {
    expect(describeQuery("tag=trending&set=Jungle&max=50")).toBe("Trending up · Jungle · $0–$50");
    expect(describeQuery("")).toBe("All cards");
  });
});
