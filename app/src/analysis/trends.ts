// Market-wide trend rules for the screener and the set/era/rarity summaries.
// Pure functions, no I/O. Every flag carries a plain-language reason, because these are
// signals to investigate, not advice — the UI shows the reasons next to the numbers.
//
// Two independent price histories feed this, and they are never mixed in one number:
//   own     — our stored daily TCGplayer market prices (USD): change vs ~7 / ~30 days ago
//   Cardmarket — avg1 / avg7 / avg30 (EUR), usable only while fresh (see isFresh)
// A percentage is a ratio inside ONE source, so the currency difference doesn't matter.

export const MIN_SCREEN_PRICE_CENTS = 300; // below ~$3 a % move is mostly rounding noise
export const TREND_UP_PCT = 10;
export const DIP_PCT = -10;
export const DIP_FLOOR_PCT = -40; // a bigger "dip" is far more likely a data glitch than a bargain
export const HIGH_VOLUME_PER_WEEK = 5;

export function pctChange(now: number | null, then: number | null): number | null {
  if (now === null || then === null || then <= 0) return null;
  return ((now - then) / then) * 100;
}

export interface TrendInput {
  priceCents: number;
  own7dCents: number | null; // our TCGplayer price ~7 days ago
  own30dCents: number | null; // ~30 days ago
  cm: { avg1: number | null; avg7: number | null; avg30: number | null } | null; // null when stale/absent
  salesPerWeek: number | null; // from tracked sold-listing data; null = not tracked
}

export type Tag = "trending" | "undervalued" | "volume";

export interface TrendSignals {
  change7dPct: number | null; // own history
  change30dPct: number | null; // own history
  cmMomentumPct: number | null; // Cardmarket 7d avg vs 30d avg
  cmDipPct: number | null; // Cardmarket 1d avg vs 30d avg
  trendPct: number | null; // the one we sort by: own 7d if we have it, else Cardmarket momentum
  trendSource: "own" | "cardmarket" | null;
  tags: Tag[];
  reasons: string[];
}

const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function computeTrendSignals(input: TrendInput): TrendSignals {
  const change7dPct = pctChange(input.priceCents, input.own7dCents);
  const change30dPct = pctChange(input.priceCents, input.own30dCents);
  const cmMomentumPct = input.cm ? pctChange(input.cm.avg7, input.cm.avg30) : null;
  const cmDipPct = input.cm ? pctChange(input.cm.avg1, input.cm.avg30) : null;

  const trendPct = change7dPct ?? cmMomentumPct;
  const trendSource = change7dPct !== null ? "own" : cmMomentumPct !== null ? "cardmarket" : null;

  const tags: Tag[] = [];
  const reasons: string[] = [];
  const priced = input.priceCents >= MIN_SCREEN_PRICE_CENTS;

  if (priced && trendPct !== null && trendPct >= TREND_UP_PCT) {
    tags.push("trending");
    reasons.push(trendSource === "own" ? `Price ${fmt(trendPct)} in the last 7 days` : `Cardmarket 7-day average ${fmt(trendPct)} vs its 30-day average`);
  }

  // Undervalued = trading below its own recent average, but not in free fall and not a glitch.
  const dip = cmDipPct ?? (change30dPct !== null ? change30dPct : null);
  const notCollapsing = (cmMomentumPct ?? 0) > -15;
  if (priced && dip !== null && dip <= DIP_PCT && dip >= DIP_FLOOR_PCT && notCollapsing) {
    tags.push("undervalued");
    reasons.push(cmDipPct !== null ? `Cardmarket 1-day average is ${fmt(cmDipPct)} below its 30-day average` : `Price is ${fmt(dip)} vs 30 days ago`);
  }

  if (input.salesPerWeek !== null && input.salesPerWeek >= HIGH_VOLUME_PER_WEEK) {
    tags.push("volume");
    reasons.push(`${input.salesPerWeek.toFixed(1)} sales per week (sold-listing data)`);
  }

  return { change7dPct, change30dPct, cmMomentumPct, cmDipPct, trendPct, trendSource, tags, reasons };
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
