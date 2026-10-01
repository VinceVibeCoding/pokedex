// One place that turns /screener URL parameters into screener options. The page, the saved
// screens and the email digest all use it, so a saved filter always means what it did when saved.

import type { ScreenerOptions, ScreenerSort } from "./screener";
import type { Tag } from "../analysis/trends";

export const SCREENER_TAGS: Tag[] = ["trending", "undervalued", "volume"];
export const SCREENER_SORTS: ScreenerSort[] = ["trend", "dip", "volume", "price"];
/** Filter keys a saved screen may carry (page number is deliberately not one of them). */
export const FILTER_KEYS = ["q", "tag", "set", "rarity", "era", "min", "max", "sort"] as const;

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dollarsToCents = (v: string | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export function parseScreenerParams(raw: RawParams): ScreenerOptions {
  const tag = SCREENER_TAGS.find((t) => t === first(raw.tag)) ?? null;
  const sort = SCREENER_SORTS.find((s) => s === first(raw.sort)) ?? "trend";
  return {
    q: (first(raw.q) ?? "").trim(),
    tag,
    sort,
    set: first(raw.set)?.trim() || null,
    rarity: first(raw.rarity)?.trim() || null,
    era: first(raw.era)?.trim() || null,
    minCents: dollarsToCents(first(raw.min)),
    maxCents: dollarsToCents(first(raw.max)),
  };
}

/** Canonical query string: only known filter keys, only non-default values, stable order. */
export function canonicalQuery(raw: RawParams): string {
  const opts = parseScreenerParams(raw);
  const out = new URLSearchParams();
  const put = (k: string, v: string | null | undefined) => {
    if (v) out.set(k, v);
  };
  put("q", opts.q);
  put("tag", opts.tag);
  put("set", opts.set);
  put("rarity", opts.rarity);
  put("era", opts.era);
  put("min", first(raw.min) && opts.minCents !== null ? first(raw.min) : null);
  put("max", first(raw.max) && opts.maxCents !== null ? first(raw.max) : null);
  put("sort", opts.sort === "trend" ? null : opts.sort);
  return out.toString();
}

export function paramsFromQuery(query: string): RawParams {
  return Object.fromEntries(new URLSearchParams(query).entries());
}

/** A short label for a filter, used as the default screen name. */
export function describeQuery(query: string): string {
  const o = parseScreenerParams(paramsFromQuery(query));
  const lo = o.minCents ?? null;
  const hi = o.maxCents ?? null;
  const parts = [
    o.tag ? { trending: "Trending up", undervalued: "Undervalued", volume: "High volume" }[o.tag] : null,
    o.set, o.era, o.rarity, o.q ? `“${o.q}”` : null,
    lo !== null || hi !== null ? `$${lo !== null ? lo / 100 : 0}–${hi !== null ? `$${hi / 100}` : "up"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "All cards";
}
