// Card-catalog helpers shared by the seed, the catalog importer and name search.

/** Lowercase, strip accents ("Flabébé" → "flabebe") and "#", collapse whitespace. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The haystack stored in cards.searchText. Includes "199/165" when the set's
 * printed total is known, so people can type the number exactly as printed.
 */
export function buildSearchText(card: {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  number: string | null;
  printedTotal?: number | null;
  rarity?: string | null;
}): string {
  const printed = card.number && card.printedTotal ? `${card.number}/${card.printedTotal}` : null;
  // "Gold Star" is the universal collector nickname for the ★-suffixed cards from the
  // Holon Phantoms/Delta Species/EX-block era — the rarity itself has no "gold" in it.
  const rarityAlias = card.rarity === "Rare Holo Star" ? "gold star" : null;
  // Cards are printed with the number zero-padded to the set's total width
  // (e.g. "034/128"), so index that form too when it differs from the raw one.
  const padded =
    card.number && card.printedTotal
      ? card.number.padStart(String(card.printedTotal).length, "0")
      : null;
  const paddedDiffers = padded !== null && padded !== card.number;
  const paddedPrinted = paddedDiffers ? `${padded}/${card.printedTotal}` : null;
  return normalizeSearch(
    [
      card.name,
      card.setName,
      card.setCode,
      card.number,
      printed,
      paddedDiffers ? padded : null,
      paddedPrinted,
      card.rarity,
      rarityAlias,
      card.id,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
