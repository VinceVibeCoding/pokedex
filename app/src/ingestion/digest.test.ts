import { describe, expect, it } from "vitest";
import { formatDigest, type DigestScreen } from "./digest";

const screen = (o: Partial<DigestScreen> = {}): DigestScreen => ({
  name: "Jungle <trending>",
  query: "tag=trending&set=Jungle",
  totalNew: 2,
  newCards: [
    { cardId: "base2-27", name: "Snorlax", setName: "Jungle", priceCents: 2406, trendPct: 12.34, reason: "Price +12.3% in the last 7 days" },
    { cardId: "base2-1", name: "Clefable & Co", setName: "Jungle", priceCents: 150000, trendPct: null, reason: null },
  ],
  ...o,
});

describe("formatDigest", () => {
  it("counts new cards in the subject and links every card", () => {
    const m = formatDigest([screen()], "https://x.test", "https://x.test/unsubscribe?token=T");
    expect(m.subject).toBe("2 new cards match your saved screens");
    expect(m.text).toContain("https://x.test/card/base2-27");
    expect(m.text).toContain("Snorlax (Jungle) — $24.06 +12.3% — Price +12.3% in the last 7 days");
    expect(m.text).toContain("not buy advice");
    expect(m.text).toContain("Unsubscribe from all alert emails: https://x.test/unsubscribe?token=T");
    expect(m.html).toContain('href="https://x.test/unsubscribe?token=T"');
  });
  it("escapes HTML in names so a screen name or card name can't inject markup", () => {
    const m = formatDigest([screen()], "https://x.test", "https://x.test/unsubscribe?token=T");
    expect(m.html).toContain("Jungle &lt;trending&gt;");
    expect(m.html).toContain("Clefable &amp; Co");
    expect(m.html).not.toContain("<trending>");
  });
  it("says how many more there are beyond the cards shown, and uses singular for one", () => {
    const m = formatDigest([screen({ totalNew: 20 })], "https://x.test", "https://x.test/unsubscribe?token=T");
    expect(m.text).toContain("…and 18 more: https://x.test/screener?tag=trending&set=Jungle");
    expect(formatDigest([screen({ totalNew: 1, newCards: [screen().newCards[0]] })], "https://x.test", "https://x.test/unsubscribe?token=T").subject).toBe("1 new card matches your saved screens");
  });
});
