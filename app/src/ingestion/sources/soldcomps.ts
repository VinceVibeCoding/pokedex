// SoldComps (https://sold-comps.com) — individual eBay SOLD listings, roughly the last
// 90 days. Used for PSA tiers only (raw stays on PokeTrace: a raw keyword search can't
// tell raw from graded listings). One request = one page of up to 40 sales.
// Auth: Bearer key. Billing is monthly (free = 100/mo), paced by SOLDCOMPS_DAILY_REQUESTS.
//
// The API has no grade / set / variant fields — everything comes from the listing title —
// so titleMatches() is deliberately conservative: a sale we can't confidently attribute to
// THIS card at THIS grade is dropped rather than polluting its price history.

import { normalizeSearch } from "../../lib/catalog";
import { detectGradeTier } from "../gradeDetect";
import { getJson } from "./http";
import { normalizeCardNumber } from "./poketrace";
import type { GradeTier } from "../../types/domain";

const BASE_URL = process.env.SOLDCOMPS_BASE_URL ?? "https://api.sold-comps.com";
const MIN_INTERVAL_MS = 1100; // 60 requests/min on standard plans

export type PsaTier = Extract<GradeTier, "psa8" | "psa9" | "psa10">;
export const PSA_TIERS: PsaTier[] = ["psa10", "psa9", "psa8"];

export interface SoldCompsItem {
  url?: string | null;
  title?: string | null;
  soldPrice?: string | number | null;
  soldCurrency?: string | null;
  endedAt?: string | null; // YYYY-MM-DD
  bestOfferAccepted?: boolean | null;
  boaAcceptedPrice?: string | number | null;
}

export interface CardForSales {
  name: string;
  setName: string;
  number: string | null;
  printedNumber?: string | null; // "27/64"
  printVariant?: string | null;
}

export interface SaleRow {
  gradeTier: GradeTier;
  priceCents: number;
  soldAt: Date;
  sourceUrl: string;
}

export function isSoldCompsConfigured(): boolean {
  return Boolean(process.env.SOLDCOMPS_API_KEY);
}

const squash = (s: string) => normalizeSearch(s).replace(/[^a-z0-9/ ]/g, "").replace(/\s+/g, " ");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOISE = /\b(lot|bundle|proxy|reprint|custom|fake|digital|sealed|pack|box)\b/;

export function buildKeyword(card: CardForSales, tier: PsaTier): string {
  const number = card.printedNumber ?? card.number ?? "";
  return `${card.name} ${card.setName} ${number} PSA ${tier.slice(3)} -lot`.replace(/\s+/g, " ").trim();
}

/** Does this eBay title describe our card at this PSA tier? Heuristic — see the file header. */
export function titleMatches(title: string, card: CardForSales, tier: PsaTier): boolean {
  if (detectGradeTier(title) !== tier) return false;
  const t = squash(title);
  if (NOISE.test(t)) return false;

  const wants1st = /1st|first/.test(card.printVariant ?? "");
  const has1st = /\b1st\b|1st ed|first ed/.test(t);
  if (wants1st !== has1st) return false;

  if (!t.includes(squash(card.name))) return false;

  const n = normalizeCardNumber(card.number);
  if (n === "") return false;
  // Strip grade digits and years so "PSA 10" / "1999" can't satisfy a card number of 10 / 19.
  const cleaned = t.replace(/\bpsa\s*\d+(\.\d)?\b/g, " ").replace(/\b(19|20)\d{2}\b/g, " ");
  const numberRe = new RegExp(`(?<![a-z0-9/])0*${escapeRe(n)}(?![a-z0-9])`);
  if (!numberRe.test(cleaned)) return false;

  const total = card.printedNumber?.split("/")[1];
  const hasPrintedTotal = total ? new RegExp(`/\\s*0*${escapeRe(total)}\\b`).test(cleaned) : false;
  return hasPrintedTotal || t.includes(squash(card.setName));
}

const toCents = (v: string | number | null | undefined): number | null => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

/** Best Offer sales show the listing price, not what the buyer paid — use the accepted price or drop it. */
export function parseSales(items: SoldCompsItem[], card: CardForSales, tier: PsaTier): SaleRow[] {
  const rows: SaleRow[] = [];
  for (const item of items) {
    if (!item.title || !item.url || !item.endedAt) continue;
    if (item.soldCurrency && item.soldCurrency !== "USD") continue;
    if (!titleMatches(item.title, card, tier)) continue;
    const priceCents = toCents(item.bestOfferAccepted ? item.boaAcceptedPrice : item.soldPrice);
    const soldAt = new Date(`${item.endedAt}T12:00:00Z`);
    if (priceCents === null || Number.isNaN(soldAt.getTime())) continue;
    rows.push({ gradeTier: tier, priceCents, soldAt, sourceUrl: item.url.split("?")[0] });
  }
  return rows;
}

/** One request: the newest sold listings for this card at this PSA tier. */
export async function fetchEbaySales(card: CardForSales, tier: PsaTier): Promise<SaleRow[]> {
  const url = new URL(`${BASE_URL}/v1/scrape`);
  url.searchParams.set("keyword", buildKeyword(card, tier));
  url.searchParams.set("count", "40");
  url.searchParams.set("sortOrder", "endedRecently");
  const page = await getJson<{ items?: SoldCompsItem[] }>({
    source: "soldcomps",
    url: url.toString(),
    headers: { Authorization: `Bearer ${process.env.SOLDCOMPS_API_KEY ?? ""}` },
    cost: 1,
    minIntervalMs: MIN_INTERVAL_MS,
  });
  return parseSales(page.items ?? [], card, tier);
}
