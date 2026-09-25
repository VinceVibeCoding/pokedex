import { describe, expect, it } from "vitest";
import { normalizeCardNumber, parseRawHistory, pickBestMatch, setNameScore, type PokeTraceCard } from "./poketrace";

const card = (overrides: Partial<PokeTraceCard>): PokeTraceCard => ({
  id: "uuid-1",
  name: "Charizard ex",
  cardNumber: "199/165",
  set: { slug: "sv-151", name: "SV: Scarlet & Violet 151" },
  variant: "Holofoil",
  refs: { tcgplayerId: "517045" },
  ...overrides,
});

describe("normalizeCardNumber", () => {
  it.each([
    ["199/165", "199"],
    ["007", "7"],
    ["0", "0"],
    ["SV107", "sv107"],
    [null, ""],
  ])("%s → %s", (input, out) => expect(normalizeCardNumber(input)).toBe(out));
});

describe("setNameScore", () => {
  it("matches set names across catalog naming styles", () => {
    expect(setNameScore("151", "SV: Scarlet & Violet 151")).toBe(3);
    expect(setNameScore("Base Set", "Base Set")).toBe(3);
    expect(setNameScore("Paldea Evolved", "SV02: Paldea Evolved")).toBeGreaterThan(0);
  });

  it("does not confuse numbered sequels", () => {
    expect(setNameScore("Base Set", "Base Set 2")).toBe(0);
  });

  it("returns 0 for unrelated sets", () => {
    expect(setNameScore("151", "Obsidian Flames")).toBe(0);
  });
});

describe("pickBestMatch", () => {
  const ours = { name: "Charizard ex", setName: "151", number: "199" };

  it("picks the card with the same number in the same set", () => {
    const result = pickBestMatch(ours, [
      card({ id: "wrong-number", cardNumber: "006/165" }),
      card({ id: "right" }),
      card({ id: "wrong-set", set: { slug: "obf", name: "Obsidian Flames" }, cardNumber: "199/197" }),
    ]);
    expect(result).toMatchObject({ ok: true, card: { id: "right" } });
  });

  it("prefers the regular print over 1st Edition / reverse holo", () => {
    const vintage = { name: "Charizard", setName: "Base Set", number: "4" };
    const result = pickBestMatch(vintage, [
      card({ id: "first-ed", name: "Charizard", cardNumber: "4/102", set: { slug: "base", name: "Base Set" }, variant: "1st_Edition_Holofoil" }),
      card({ id: "unlimited", name: "Charizard", cardNumber: "4/102", set: { slug: "base", name: "Base Set" }, variant: "Holofoil" }),
    ]);
    expect(result).toMatchObject({ ok: true, card: { id: "unlimited" } });
  });

  it("refuses to guess when no candidate is in the right set", () => {
    const result = pickBestMatch(ours, [card({ set: { slug: "x", name: "Obsidian Flames" } })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Obsidian Flames");
  });
});

describe("parseRawHistory", () => {
  it("converts dollars to cents, maps sources, and marks everything raw", () => {
    const points = parseRawHistory([
      { date: "2026-09-20", source: "ebay", avg: 412.5, low: 380, high: 450, saleCount: 6, approxSaleCount: false },
      { date: "2026-09-20T00:00:00Z", source: "tcgplayer", avg: 399.99, saleCount: 2 },
    ]);
    expect(points).toEqual([
      expect.objectContaining({ source: "poketrace_ebay", gradeTier: "raw", date: "2026-09-20", avgPriceCents: 41250, lowPriceCents: 38000, saleCount: 6 }),
      expect.objectContaining({ source: "poketrace_tcgplayer", date: "2026-09-20", avgPriceCents: 39999, saleCount: 2 }),
    ]);
  });

  it("skips unknown sources and days without a price", () => {
    expect(
      parseRawHistory([
        { date: "2026-09-20", source: "cardmarket", avg: 10, saleCount: 1 },
        { date: "2026-09-21", source: "ebay", avg: null, saleCount: 0 },
      ]),
    ).toEqual([]);
  });
});
