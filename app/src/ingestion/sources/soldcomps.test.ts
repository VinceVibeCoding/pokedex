import { describe, expect, it } from "vitest";
import { buildKeyword, parseSales, titleMatches, type CardForSales } from "./soldcomps";

const snorlax11: CardForSales = { name: "Snorlax", setName: "Jungle", number: "11", printedNumber: "11/64" };
const snorlax27: CardForSales = { name: "Snorlax", setName: "Jungle", number: "27", printedNumber: "27/64" };

describe("titleMatches", () => {
  it("accepts the unlimited print at the right grade", () => {
    expect(titleMatches("1999 Pokemon Snorlax Holo PSA 10 11/64 Jungle Vintage", snorlax11, "psa10")).toBe(true);
  });
  it("rejects 1st Edition for an unlimited card, and requires it for a 1st Edition card", () => {
    const t = "Wizards of the Coast 1999 Pokemon Jungle 1st Ed Snorlax Holo 11/64 PSA 10";
    expect(titleMatches(t, snorlax11, "psa10")).toBe(false);
    expect(titleMatches(t, { ...snorlax11, printVariant: "1st edition" }, "psa10")).toBe(true);
  });
  it("rejects the wrong grade, the wrong number, lots and other cards", () => {
    expect(titleMatches("Snorlax Jungle 11/64 PSA 9", snorlax11, "psa10")).toBe(false);
    expect(titleMatches("Snorlax Jungle 27/64 PSA 10", snorlax11, "psa10")).toBe(false);
    expect(titleMatches("Snorlax Jungle 11/64 PSA 10 lot of 3", snorlax11, "psa10")).toBe(false);
    expect(titleMatches("Pikachu Jungle 11/64 PSA 10", snorlax11, "psa10")).toBe(false);
  });
  it("does not let 'PSA 10' or a year satisfy a card number of 10 or 19", () => {
    const card: CardForSales = { name: "Pikachu", setName: "Jungle", number: "10", printedNumber: "10/64" };
    expect(titleMatches("1999 Pikachu Jungle PSA 10", card, "psa10")).toBe(false);
    expect(titleMatches("1999 Pikachu Jungle 10/64 PSA 10", card, "psa10")).toBe(true);
  });
  it("needs the set name or the printed total", () => {
    expect(titleMatches("Snorlax 27 PSA 10", snorlax27, "psa10")).toBe(false);
    expect(titleMatches("Snorlax 27/64 PSA 10", snorlax27, "psa10")).toBe(true);
  });
});

describe("parseSales", () => {
  const good = { url: "https://www.ebay.com/itm/1?x=1", title: "Snorlax Jungle 11/64 PSA 10", soldPrice: "72858.50", soldCurrency: "USD", endedAt: "2026-09-22" };
  it("converts to cents, strips tracking params and pins the sale to noon UTC", () => {
    expect(parseSales([good], snorlax11, "psa10")).toEqual([
      { gradeTier: "psa10", priceCents: 7285850, soldAt: new Date("2026-09-22T12:00:00Z"), sourceUrl: "https://www.ebay.com/itm/1" },
    ]);
  });
  it("uses the accepted Best Offer price, and drops the sale if it isn't known", () => {
    expect(parseSales([{ ...good, bestOfferAccepted: true, boaAcceptedPrice: 60000 }], snorlax11, "psa10")[0].priceCents).toBe(6000000);
    expect(parseSales([{ ...good, bestOfferAccepted: true }], snorlax11, "psa10")).toEqual([]);
  });
  it("skips non-USD, unmatched and incomplete items", () => {
    expect(parseSales([{ ...good, soldCurrency: "GBP" }, { ...good, title: "Charizard PSA 10" }, { ...good, endedAt: null }], snorlax11, "psa10")).toEqual([]);
  });
});

describe("buildKeyword", () => {
  it("uses the printed number and the grade", () => {
    expect(buildKeyword(snorlax27, "psa9")).toBe("Snorlax Jungle 27/64 PSA 9 -lot");
  });
});
