// PokeTrace (https://poketrace.com/docs) — free tier: 250 requests/day, 1 request/2s,
// RAW prices only (graded tiers need the Pro plan; individual sold listings need Scale).
// Used for two things:
//   1. Matching our catalog card to PokeTrace's card, which also gives us the
//      TCGplayer product ID that PokemonPriceTracker is keyed on.
//   2. Raw (NEAR_MINT) daily price history with sale counts, per source (eBay, TCGplayer).
// Auth: X-API-Key header. Prices are in dollars.

import { normalizeSearch } from "../../lib/catalog";
import { getJson } from "./http";
import { dollarsToCents, type DailyPoint, type DailySourceName, type ExternalRefs } from "./types";

const BASE_URL = process.env.POKETRACE_BASE_URL ?? "https://api.poketrace.com/v1";
const MIN_INTERVAL_MS = 2100; // free tier: 1 request / 2s
const MAX_HISTORY_PAGES = 4; // 50/page → up to 200 days×sources; the 90d backfill needs ≤ 4

export interface PokeTraceCard {
  id: string;
  name: string;
  cardNumber: string | null;
  set: { slug: string; name: string } | null;
  variant: string | null;
  refs?: { tcgplayerId?: string | null } | null;
}

export interface PokeTraceHistoryEntry {
  date: string;
  source: string;
  avg: number | null;
  low?: number | null;
  high?: number | null;
  saleCount?: number | null;
  approxSaleCount?: boolean | null;
  median3d?: number | null;
}

interface Page<T> {
  data: T[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
}

export function isPokeTraceConfigured(): boolean {
  return Boolean(process.env.POKETRACE_API_KEY);
}

function request<T>(path: string, params: Record<string, string>) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return getJson<T>({
    source: "poketrace",
    url: url.toString(),
    headers: { "X-API-Key": process.env.POKETRACE_API_KEY ?? "" },
    cost: 1,
    minIntervalMs: MIN_INTERVAL_MS,
  });
}

// ---------- card matching (pure, unit-tested) ----------

/** "199/165" → "199", "007" → "7", "SV107" → "sv107". */
export function normalizeCardNumber(value: string | null | undefined): string {
  return (value ?? "").split("/")[0].trim().toLowerCase().replace(/^0+(?=\d)/, "");
}

/** Set names differ across catalogs ("151" vs "SV: Scarlet & Violet 151"); compare loosely. */
export function setNameScore(ours: string, theirs: string): number {
  const clean = (s: string) =>
    normalizeSearch(s)
      .replace(/pokemon|scarlet & violet|scarlet and violet|sword & shield|sun & moon|\bsv\b|\bswsh\b|\bsm\b|[:\-—&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = clean(ours);
  const b = clean(theirs);
  if (a === "" || b === "") return 0;
  if (a === b) return 3;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.includes(shorter)) return 0;
  // "base set" vs "base set 2" are different sets — a bare number left over means no match.
  return /^\d+$/.test(longer.replace(shorter, "").trim()) ? 0 : 2;
}

// Base printings first: our catalog card is the regular/unlimited print, so a
// 1st Edition or reverse-holo variant is only chosen when nothing else matches.
const VARIANT_PREFERENCE: Record<string, number> = {
  Holofoil: 2,
  Normal: 2,
  Unlimited: 2,
  Unlimited_Holofoil: 2,
  Reverse_Holofoil: 0,
  "1st_Edition": 0,
  "1st_Edition_Holofoil": 0,
};

export type MatchResult = { ok: true; card: PokeTraceCard } | { ok: false; reason: string };

export function pickBestMatch(
  ours: { name: string; setName: string; number: string | null },
  candidates: PokeTraceCard[],
): MatchResult {
  const ourNumber = normalizeCardNumber(ours.number);
  const scored = candidates
    .filter((c) => ourNumber === "" || normalizeCardNumber(c.cardNumber) === ourNumber)
    .map((c) => ({
      card: c,
      setScore: setNameScore(ours.setName, c.set?.name ?? ""),
      score:
        setNameScore(ours.setName, c.set?.name ?? "") * 10 +
        (normalizeSearch(c.name) === normalizeSearch(ours.name) ? 5 : 0) +
        (VARIANT_PREFERENCE[c.variant ?? ""] ?? 1),
    }))
    .filter((s) => s.setScore > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const seen = candidates
      .slice(0, 5)
      .map((c) => `${c.name} · ${c.set?.name ?? "?"} #${c.cardNumber ?? "?"}`)
      .join("; ");
    return { ok: false, reason: `No PokeTrace card matched set "${ours.setName}" #${ours.number ?? "?"}. Candidates: ${seen || "none"}` };
  }
  return { ok: true, card: scored[0].card };
}

/** Finds our card on PokeTrace. 1–2 requests. */
export async function findPokeTraceCard(ours: {
  name: string;
  setName: string;
  number: string | null;
}): Promise<{ refs: ExternalRefs } | { error: string }> {
  const base = { search: ours.name, game: "pokemon", market: "US", product_type: "single", limit: "20" };
  let page = await request<Page<PokeTraceCard>>("/cards", ours.number ? { ...base, card_number: ours.number } : base);
  let match = pickBestMatch(ours, page.data);
  // Their card_number filter may expect "199/165"-style numbers; retry by name only.
  if (!match.ok && ours.number) {
    page = await request<Page<PokeTraceCard>>("/cards", base);
    match = pickBestMatch(ours, page.data);
  }
  if (!match.ok) return { error: match.reason };
  return { refs: { poketraceId: match.card.id, tcgplayerId: match.card.refs?.tcgplayerId ?? null } };
}

// ---------- raw daily history ----------

const SOURCE_MAP: Record<string, DailySourceName> = {
  ebay: "poketrace_ebay",
  tcgplayer: "poketrace_tcgplayer",
};

/** Pure: history entries → daily points. Skips unknown sources and days with no price. */
export function parseRawHistory(entries: PokeTraceHistoryEntry[]): DailyPoint[] {
  const points: DailyPoint[] = [];
  for (const e of entries) {
    const source = SOURCE_MAP[e.source];
    const avg = dollarsToCents(e.avg);
    if (!source || avg === null) continue;
    points.push({
      source,
      gradeTier: "raw",
      date: e.date.slice(0, 10),
      avgPriceCents: avg,
      medianPriceCents: null, // their medians are rolling (3d/7d/30d), not that day's
      lowPriceCents: dollarsToCents(e.low),
      highPriceCents: dollarsToCents(e.high),
      saleCount: Math.max(0, e.saleCount ?? 0),
      approxSaleCount: Boolean(e.approxSaleCount),
    });
  }
  return points;
}

/** Raw NEAR_MINT daily history. `period` 90d for the first fetch, 7d for daily refreshes. */
export async function fetchRawHistory(poketraceId: string, period: "7d" | "30d" | "90d"): Promise<DailyPoint[]> {
  const entries: PokeTraceHistoryEntry[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const params: Record<string, string> = { period, limit: "50" }; // documented default page size
    if (cursor) params.cursor = cursor;
    const res: Page<PokeTraceHistoryEntry> = await request(
      `/cards/${encodeURIComponent(poketraceId)}/prices/NEAR_MINT/history`,
      params,
    );
    entries.push(...res.data);
    if (!res.pagination?.hasMore || !res.pagination.nextCursor) break;
    cursor = res.pagination.nextCursor;
  }
  return parseRawHistory(entries);
}
