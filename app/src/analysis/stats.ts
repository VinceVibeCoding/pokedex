// Weighted price statistics shared by every analysis function.
//
// The analysis works on price observations, not only individual sales:
//   - an individual sale (Comp) is an observation with weight 1
//   - a daily summary ("5 sales, average $100") is ONE observation with weight 5
// Every statistic here treats an observation of weight w exactly like w identical
// sales, so individual-sale data gives the same results as before weights existed.
// Caveat for daily summaries: all w sales sit at the day's average, so spread
// (volatility, typical range) is understated compared with individual sales.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Structurally compatible with Comp, so Comp[] can be passed directly. */
export interface PriceObservation {
  soldAt: string; // ISO datetime (daily summaries: noon UTC of that day)
  priceCents: number;
  weight?: number; // number of sales this observation stands for; default 1
}

export function weightOf(o: PriceObservation): number {
  return o.weight ?? 1;
}

export function totalWeight(obs: PriceObservation[]): number {
  return obs.reduce((acc, o) => acc + weightOf(o), 0);
}

/** Observations sold within the trailing `days` from `now`. */
export function within<T extends PriceObservation>(obs: T[], now: Date, days: number): T[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return obs.filter((o) => new Date(o.soldAt).getTime() >= cutoff);
}

/** Observations sold in [now − toDaysAgo, now − fromDaysAgo). */
export function between<T extends PriceObservation>(
  obs: T[],
  now: Date,
  fromDaysAgo: number,
  toDaysAgo: number,
): T[] {
  const start = now.getTime() - toDaysAgo * DAY_MS;
  const end = now.getTime() - fromDaysAgo * DAY_MS;
  return obs.filter((o) => {
    const t = new Date(o.soldAt).getTime();
    return t >= start && t < end;
  });
}

export function weightedMean(obs: PriceObservation[]): number | null {
  const w = totalWeight(obs);
  if (w === 0) return null;
  return obs.reduce((acc, o) => acc + o.priceCents * weightOf(o), 0) / w;
}

/** Sample standard deviation with frequency weights (n − 1). Null below 2 sales. */
export function weightedStddev(obs: PriceObservation[]): number | null {
  const w = totalWeight(obs);
  if (w < 2) return null;
  const m = weightedMean(obs)!;
  const ss = obs.reduce((acc, o) => acc + weightOf(o) * (o.priceCents - m) ** 2, 0);
  return Math.sqrt(ss / (w - 1));
}

/**
 * Percentile p (0..1), linearly interpolated, as if each observation were
 * repeated `weight` times. Rounded to whole cents. Null with no observations.
 */
export function weightedPercentile(obs: PriceObservation[], p: number): number | null {
  const w = totalWeight(obs);
  if (w === 0) return null;
  const sorted = [...obs].sort((a, b) => a.priceCents - b.priceCents);

  // Value at position k (0-based) of the virtual expanded list.
  const valueAt = (k: number): number => {
    let cum = 0;
    for (const o of sorted) {
      cum += weightOf(o);
      if (k < cum) return o.priceCents;
    }
    return sorted[sorted.length - 1].priceCents;
  };

  const idx = (w - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = valueAt(lo);
  const b = valueAt(hi);
  return Math.round(a + (b - a) * (idx - lo));
}

export function weightedMedian(obs: PriceObservation[]): number | null {
  return weightedPercentile(obs, 0.5);
}
