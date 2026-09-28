// Market News — headlines generated from our own data (indexes + movers), so every
// item is verifiable against the Indexes / Sold History pages. No external feed yet.

import { getMarketIndexes } from "./indexes";
import { getTopMovers, type Mover } from "./movers";
import { GRADE_LABELS } from "../lib/grade";
import { formatCents, formatPct } from "../lib/format";

export interface NewsItem {
  id: string;
  tag: "Index" | "Gainer" | "Loser";
  headline: string;
  body: string;
  href: string;
  imageUrl: string | null;
}

const moverItem = (m: Mover, kind: "Gainer" | "Loser"): NewsItem => ({
  id: `${kind}:${m.cardId}:${m.gradeTier}`,
  tag: kind,
  headline: `${m.cardName} (${GRADE_LABELS[m.gradeTier]}) ${kind === "Gainer" ? "climbs" : "slips"} ${formatPct(Math.abs(m.changePct), 1).replace("+", "")}`,
  body: `${m.setName} · now averaging ${formatCents(m.priceCents)} over the last 3 days versus the 4 days before.`,
  href: `/card/${encodeURIComponent(m.cardId)}?grade=${m.gradeTier}`,
  imageUrl: m.imageUrl,
});

export async function getMarketNews(): Promise<NewsItem[]> {
  const [indexes, movers] = await Promise.all([getMarketIndexes(), getTopMovers()]);
  const items: NewsItem[] = [];

  for (const ix of indexes) {
    if (ix.change7dPct === null || ix.cardCount < 2) continue;
    const dir = ix.change7dPct >= 0 ? "up" : "down";
    items.push({
      id: `index:${ix.gradeTier}`,
      tag: "Index",
      headline: `${GRADE_LABELS[ix.gradeTier]} index ${dir} ${formatPct(Math.abs(ix.change7dPct), 1).replace("+", "")} this week`,
      body: `Across ${ix.cardCount} tracked cards; ${ix.change30dPct === null ? "30-day change unavailable" : `${formatPct(ix.change30dPct, 1)} over 30 days`}.`,
      href: "/indexes",
      imageUrl: null,
    });
  }
  for (const m of movers.gainers.slice(0, 3)) items.push(moverItem(m, "Gainer"));
  for (const m of movers.losers.slice(0, 3)) items.push(moverItem(m, "Loser"));
  return items;
}
