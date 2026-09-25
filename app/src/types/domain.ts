// Shared domain types — single source of truth for API and all UIs
// (web, Chrome extension, iPhone app all consume these shapes).
// See .obsidian-vault/CLAUDE.md for definitions and rationale.

/** Grade is part of a comp's identity — never mix raw and graded comps. */
export type GradeTier = "raw" | "psa8" | "psa9" | "psa10";

/** Authoritative comp data sources. Recorded on every comp for weighting/reconciliation. */
export type CompSource = "tcgplayer" | "collectr" | "one30point";

/** Static card metadata — cache forever. */
export interface Card {
  id: string; // canonical card ID, the lookup key
  name: string;
  setName: string;
  setCode: string;
  releaseDate: string; // ISO date
  cardType: string; // e.g. "Pokemon", "Trainer", "Energy"
  rarity: string;
  pullRate: number | null; // e.g. 0.005 = 1 in 200 packs
  artist: string | null;
  printVariant: string | null; // e.g. "holo", "reverse holo", "1st edition"
  number: string | null; // collector number as printed, e.g. "199"
  imageUrl: string | null;
  imageUrlLarge: string | null;
}

/** One row in the name-search dropdown — just enough to pick the right card. */
export interface CardSearchResult {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  rarity: string;
  releaseDate: string; // ISO date
  imageUrl: string | null;
}

/** A completed sale of a specific card at a specific grade. Append-only. */
export interface Comp {
  id: string;
  cardId: string;
  gradeTier: GradeTier;
  priceCents: number; // integer cents — never float money
  currency: string; // ISO 4217
  soldAt: string; // ISO datetime
  condition: string | null; // raw listings only (e.g. "NM", "LP")
  source: CompSource;
  sourceUrl: string | null;
}

/** Market signals derived from comps — computed per grade tier. */
export interface MarketSignals {
  cardId: string;
  gradeTier: GradeTier;
  salesTotal: number;
  salesPerDay: number;
  salesPerWeek: number;
  salesPerMonth: number;
  lastSaleAt: string | null;
  lastSalePriceCents: number | null;
  priceTrendPct: number | null; // % change of recent vs prior window
  volatility: number | null; // stddev / mean of recent prices
  computedAt: string;
}

/** Composite score from volume + recency + volatility. Formula documented in analysis/. */
export interface MarketStabilityIndex {
  score: number; // 0–100
  volumeComponent: number;
  recencyComponent: number;
  volatilityComponent: number;
}

/** Data-science output — must be explainable in the UI. */
export interface BuyScore {
  score: number; // 0–100
  verdict: "strong_buy" | "buy" | "hold" | "avoid";
  trendSlope: number | null;
  deviationFromMovingAvgPct: number | null;
  reasons: string[]; // human-readable explanation shown in the UI
}

/** Which grade tier is most worth buying for this card. */
export interface GradePremiumAnalysis {
  cardId: string;
  gradingCostCents: number; // assumption used in the calculation
  tiers: Array<{
    gradeTier: GradeTier;
    marketPriceCents: number | null;
    premiumOverRawPct: number | null;
    valueScore: number | null; // price-to-value ratio
  }>;
  recommendedTier: GradeTier | null; // null when insufficient data
}

/**
 * What a card is worth at one grade tier, and the most you can pay to flip it.
 * Money math and fee assumptions are documented in analysis/pricing.ts.
 */
export interface PriceGuide {
  marketPriceCents: number; // median of the basis window — the "fair price"
  basis: "30d" | "90d"; // 90d is the fallback when there were no sales in 30d
  sampleSize: number; // sales in the basis window
  typicalLowCents: number; // 25th percentile of the basis window
  typicalHighCents: number; // 75th percentile
  netAfterFeesCents: number; // what you'd pocket selling at market after fees + shipping
  maxBuyPrices: Array<{ targetRoiPct: number; priceCents: number }>; // 0% = break-even
}

/** A single completed sale, trimmed for charts and the "recent sales" list. */
export interface RecentSale {
  soldAt: string; // ISO datetime
  priceCents: number;
  source: CompSource;
  sourceUrl: string | null;
}

/** One day's sales from a summary-only source (free API tiers). */
export interface DailySale {
  date: string; // YYYY-MM-DD
  avgPriceCents: number;
  saleCount: number;
}

/** Where a tier's numbers come from — shown in the UI so thin data is never hidden. */
export interface PriceBasis {
  kind: "sales" | "daily"; // individual sales, or daily summaries weighted by sale count
  label: string; // e.g. "eBay daily sales · PokemonPriceTracker"
}

/** One tier's slice of a lookup response. All nullable — "insufficient data" is a valid state, not an error. */
export interface TierSnapshot {
  gradeTier: GradeTier;
  signals: MarketSignals | null;
  stability: MarketStabilityIndex | null;
  priceGuide: PriceGuide | null;
  buyScore: BuyScore | null; // computed on THIS tier's data only
  basis: PriceBasis | null; // null when the tier has no data
  recentSales: RecentSale[]; // individual sales, trailing 90d, newest first (empty for daily data)
  dailySales: DailySale[]; // daily summaries with ≥1 sale, trailing 90d, newest first (empty for individual data)
}

/** Everything about a card, independent of which grade the user picked. Cached by card ID. */
export interface CardSnapshot {
  card: Card;
  tiers: TierSnapshot[]; // always all 4 tiers; nulls mean insufficient data
  gradePremium: GradePremiumAnalysis | null;
  defaultTier: GradeTier; // tier with the most sales — shown when no grade is requested
  dataFreshnessAt: string | null; // when ingestion last wrote a comp for this card
  computedAt: string; // when this snapshot was built — the "now" for relative dates in UIs
}

/** Price-fetching state for a card. Not cached — it changes while a fetch runs. */
export interface TrackingStatus {
  sourcesConfigured: boolean; // false until API keys are in .env
  tracked: boolean;
  fetching: boolean;
  lastRefreshedAt: string | null;
  lastError: string | null;
  mappingError: string | null; // couldn't match this card on the price source
}

/** The single self-contained API response — everything the UI renders in one call. */
export interface CardLookupResponse extends CardSnapshot {
  selectedTier: GradeTier; // the requested grade, or defaultTier
  tracking: TrackingStatus;
}
