import { describe, expect, it } from "vitest";
import { buildSearchText, normalizeSearch } from "./catalog";

describe("normalizeSearch", () => {
  it("lowercases, strips accents and '#', collapses spaces", () => {
    expect(normalizeSearch("  Flabébé   #12 ")).toBe("flabebe 12");
  });
});

describe("buildSearchText", () => {
  it("includes name, set, number and the printed number/total", () => {
    const text = buildSearchText({
      id: "sv3pt5-199",
      name: "Charizard ex",
      setName: "151",
      setCode: "sv3pt5",
      number: "199",
      printedTotal: 165,
    });
    expect(text).toBe("charizard ex 151 sv3pt5 199 199/165 sv3pt5-199");
  });

  it("indexes the zero-padded printed number too (e.g. '034/128')", () => {
    const text = buildSearchText({
      id: "me55-34",
      name: "Pikachu",
      setName: "30th Celebration",
      setCode: "me55",
      number: "34",
      printedTotal: 128,
    });
    expect(text).toBe("pikachu 30th celebration me55 34 34/128 034 034/128 me55-34");
  });

  it("indexes rarity, and aliases 'Rare Holo Star' to the collector term 'gold star'", () => {
    const text = buildSearchText({
      id: "hp-104",
      name: "Pikachu ★",
      setName: "Holon Phantoms",
      setCode: "hp",
      number: "104",
      rarity: "Rare Holo Star",
    });
    expect(text).toBe("pikachu ★ holon phantoms hp 104 rare holo star gold star hp-104");
  });

  it("skips missing parts", () => {
    expect(
      buildSearchText({ id: "base1-4", name: "Charizard", setName: "Base Set", setCode: "base1", number: null }),
    ).toBe("charizard base set base1 base1-4");
  });
});
