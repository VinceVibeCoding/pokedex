// Picks ONE data series per grade tier. Sources overlap (PokeTrace and
// PokemonPriceTracker both see the same eBay sales), so combining them would
// double-count. Rule:
//   1. individual sales (comps) in the window, if any — the most precise data
//   2. otherwise the daily source with the most sales in the window
//      (ties → SOURCE_PREFERENCE order)
// Daily rows with 0 sales (a price quote, nothing sold) are not sales and are ignored.

import type { PriceObservation } from "../analysis";
import type { Comp, DailySale, PriceBasis } from "../types/domain";
import type { DailySourceName } from "../ingestion/sources/types";

export interface DailyRow {
  source: DailySourceName;
  date: Date;
  avgPriceCents: number;
  medianPriceCents: number | null;
  saleCount: number;
}

export const SOURCE_LABELS: Record<DailySourceName, string> = {
  ppt_ebay: "eBay daily sales · PokemonPriceTracker",
  poketrace_ebay: "eBay daily sales · PokeTrace",
  poketrace_tcgplayer: "TCGplayer daily sales · PokeTrace",
};

const SOURCE_PREFERENCE: DailySourceName[] = ["ppt_ebay", "poketrace_ebay", "poketrace_tcgplayer"];

export interface TierSeries {
  basis: PriceBasis;
  observations: PriceObservation[];
  comps: Comp[]; // non-empty only for kind "sales"
  dailySales: DailySale[]; // non-empty only for kind "daily"; newest first
}

/** A day's sales sit at noon UTC so day-based windows never split a day. */
function dailyToObservation(row: DailyRow): PriceObservation {
  const day = row.date.toISOString().slice(0, 10);
  return {
    soldAt: `${day}T12:00:00.000Z`,
    priceCents: row.medianPriceCents ?? row.avgPriceCents,
    weight: row.saleCount,
  };
}

export function chooseSeries(comps: Comp[], daily: DailyRow[]): TierSeries | null {
  if (comps.length > 0) {
    return { basis: { kind: "sales", label: "Individual sales" }, observations: comps, comps, dailySales: [] };
  }

  const withSales = daily.filter((d) => d.saleCount > 0);
  if (withSales.length === 0) return null;

  const salesBySource = new Map<DailySourceName, number>();
  for (const d of withSales) salesBySource.set(d.source, (salesBySource.get(d.source) ?? 0) + d.saleCount);
  const best = [...salesBySource.entries()].sort(
    (a, b) => b[1] - a[1] || SOURCE_PREFERENCE.indexOf(a[0]) - SOURCE_PREFERENCE.indexOf(b[0]),
  )[0][0];

  const rows = withSales
    .filter((d) => d.source === best)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    basis: { kind: "daily", label: SOURCE_LABELS[best] },
    observations: rows.map(dailyToObservation),
    comps: [],
    dailySales: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      avgPriceCents: r.medianPriceCents ?? r.avgPriceCents,
      saleCount: r.saleCount,
    })),
  };
}
