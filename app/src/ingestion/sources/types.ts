// Shapes shared by the summary-only (daily) price sources.

import type { GradeTier } from "../../types/domain";

export type DailySourceName = "ppt_ebay" | "poketrace_ebay" | "poketrace_tcgplayer";

/** One day of sales for one grade tier from one source, normalized to cents. */
export interface DailyPoint {
  source: DailySourceName;
  gradeTier: GradeTier;
  date: string; // YYYY-MM-DD (UTC)
  avgPriceCents: number;
  medianPriceCents: number | null;
  lowPriceCents: number | null;
  highPriceCents: number | null;
  saleCount: number;
  approxSaleCount: boolean;
}

/** Card identity as the external sources see it, learned once per tracked card. */
export interface ExternalRefs {
  poketraceId: string;
  tcgplayerId: string | null;
}

export function dollarsToCents(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;
}
