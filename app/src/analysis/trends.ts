// Market-wide trend rules for the screener and the set/era/rarity summaries.
// Pure functions, no I/O. Every flag carries a plain-language reason, because these are
// signals to investigate, not advice — the UI shows the reasons next to the numbers.
//
// Three independent price histories can feed this, and they are never mixed in one number:
//   own        — our stored daily TCGplayer market prices (USD): change vs ~7 / ~30 days ago
//   sales      — real sold-listing averages for cards we track (raw tier, one source)
//   Cardmarket — avg1 / avg7 / avg30 (EUR), usable only while fresh (see isFresh)
// A percentage is a ratio inside ONE source, so currency differences don't matter. Priority
// for the headline trend: own > sales > Cardmarket.

export const MIN_SCREEN_PRICE_CENTS = 300; // below ~$3 a % move is mostly rounding noise
export const TREND_UP_PCT = 10;
export const DIP_PCT = -10;
export const DIP_FLOOR_PCT = -40; // a bigger "dip" is far more likely a data glitch than a bargain
export const HIGH_VOLUME_PER_WEEK = 5;
// Sold-price windows need enough sales to mean anything — two sales can't make a trend.
export const MIN_SALES_7D = 3;
export const MIN_SALES_30D = 8;
export const MIN_SALES_3D = 2;

export function pctChange(now: number | null, then: number | null): number | null {
  if (now === null || then === null || then <= 0) return null;
  return ((now - then) / then) * 100;
}

export interface TrendInput {
  priceCents: number;
  own7dCents: number | null; // our TCGplayer price ~7 days ago
  own30dCents: number | null; // ~30 days ago
  cm: { avg1: number | null; avg7: number | null; avg30: number | null } | null; // null when stale/absent
  sold: SoldWindows | null; // null when the card isn't tracked
  salesPerWeek: number | null; // from tracked sold-listing data; null = not tracked
}

/** Sale-weighted average sold price over trailing windows, plus how many sales each holds. */
export interface SoldWindows {
  avg3: number | null;
  avg7: number | null;
  avg30: number | null;
  sales3: number;
  sales7: number;
  sales30: number;
}

export type Tag = "trending" | "undervalued" | "volume";

export interface TrendSignals {
  change7dPct: number | null; // own history
  change30dPct: number | null; // own history
  cmMomentumPct: number | null; // Cardmarket 7d avg vs 30d avg
  cmDipPct: number | null; // Cardmarket 1d avg vs 30d avg
  soldMomentumPct: number | null; // sold price, last 7 days vs 30-day average
  soldDipPct: number | null; // sold price, last 3 days vs 30-day average
  trendPct: number | null; // the one we sort by (see priority above)
  trendSource: "own" | "sales" | "cardmarket" | null;
  tags: Tag[];
  reasons: string[];
}

const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function computeTrendSignals(input: TrendInput): TrendSignals {
  const change7dPct = pctChange(input.priceCents, input.own7dCents);
  const change30dPct = pctChange(input.priceCents, input.own30dCents);
  const cmMomentumPct = input.cm ? pctChange(input.cm.avg7, input.cm.avg30) : null;
  const cmDipPct = input.cm ? pctChange(input.cm.avg1, input.cm.avg30) : null;

  const sw = input.sold;
  const soldMomentumPct = sw && sw.sales7 >= MIN_SALES_7D && sw.sales30 >= MIN_SALES_30D ? pctChange(sw.avg7, sw.avg30) : null;
  const soldDipPct = sw && sw.sales3 >= MIN_SALES_3D && sw.sales30 >= MIN_SALES_30D ? pctChange(sw.avg3, sw.avg30) : null;

  const trendPct = change7dPct ?? soldMomentumPct ?? cmMomentumPct;
  const trendSource = change7dPct !== null ? "own" : soldMomentumPct !== null ? "sales" : cmMomentumPct !== null ? "cardmarket" : null;

  const tags: Tag[] = [];
  const reasons: string[] = [];
  const priced = input.priceCents >= MIN_SCREEN_PRICE_CENTS;

  if (priced && trendPct !== null && trendPct >= TREND_UP_PCT) {
    tags.push("trending");
    reasons.push(
      trendSource === "own"
        ? `Price ${fmt(trendPct)} in the last 7 days`
        : trendSource === "sales"
          ? `Sold prices ${fmt(trendPct)} (last 7 days vs 30-day average, ${sw?.sales7} sales)`
          : `Cardmarket 7-day average ${fmt(trendPct)} vs its 30-day average`,
    );
  }

  // Undervalued = trading below its own recent average, but not in free fall and not a glitch.
  // Prefer real sold prices, then Cardmarket, then our own 30-day change.
  const dip = soldDipPct ?? cmDipPct ?? change30dPct;
  const momentum = soldMomentumPct ?? cmMomentumPct;
  const notCollapsing = (momentum ?? 0) > -15;
  if (priced && dip !== null && dip <= DIP_PCT && dip >= DIP_FLOOR_PCT && notCollapsing) {
    tags.push("undervalued");
    reasons.push(
      soldDipPct !== null
        ? `Last 3 days of sales average ${fmt(soldDipPct)} vs the 30-day average (${sw?.sales3} sales)`
        : cmDipPct !== null
          ? `Cardmarket 1-day average is ${fmt(cmDipPct)} below its 30-day average`
          : `Price is ${fmt(dip)} vs 30 days ago`,
    );
  }

  if (input.salesPerWeek !== null && input.salesPerWeek >= HIGH_VOLUME_PER_WEEK) {
    tags.push("volume");
    reasons.push(`${input.salesPerWeek.toFixed(1)} sales per week (sold-listing data)`);
  }

  return { change7dPct, change30dPct, cmMomentumPct, cmDipPct, soldMomentumPct, soldDipPct, trendPct, trendSource, tags, reasons };
}

// ---------- eras ----------
// Approximate, by the year a set was released; the boundaries follow the game's own eras.
export const ERAS: Array<{ label: string; fromYear: number }> = [
  { label: "Wizards of the Coast (1999–2002)", fromYear: 0 },
  { label: "e-Card & EX (2003–2006)", fromYear: 2003 },
  { label: "Diamond & Pearl / Platinum (2007–2010)", fromYear: 2007 },
  { label: "Black & White (2011–2013)", fromYear: 2011 },
  { label: "XY (2014–2016)", fromYear: 2014 },
  { label: "Sun & Moon (2017–2019)", fromYear: 2017 },
  { label: "Sword & Shield (2020–2022)", fromYear: 2020 },
  { label: "Scarlet & Violet (2023+)", fromYear: 2023 },
];

export function eraOf(year: number): string {
  let label = ERAS[0].label;
  for (const era of ERAS) if (year >= era.fromYear) label = era.label;
  return label;
}

// ---------- segment headlines ----------
export interface SegmentStats {
  label: string;
  cards: number;
  changePct: number | null; // like-for-like basket change (same cards then and now)
  pctUp: number | null; // share of cards up over the same period
  window: "7d" | "30d" | "cm"; // cm = Cardmarket 7-day average vs its 30-day average
}

export function segmentHeadline(s: SegmentStats): string | null {
  if (s.changePct === null) return null;
  const dir = s.changePct >= 0 ? "up" : "down";
  const breadth = s.pctUp === null ? "" : `, ${Math.round(s.pctUp)}% of cards rising`;
  const span = s.window === "7d" ? "over 7 days" : s.window === "30d" ? "over 30 days" : "(Cardmarket 7-day vs 30-day average)";
  return `${s.label} ${dir} ${Math.abs(s.changePct).toFixed(1)}% ${span} across ${s.cards.toLocaleString()} cards${breadth}`;
}
