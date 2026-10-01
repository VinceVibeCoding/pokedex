// Track record — how did cards the screener flagged actually do afterwards?
// Pure statistics, no I/O. The honest comparison is NOT "did flagged cards go up" (in a rising
// market everything does) but "did they beat the typical card over the same days", so every
// result carries a baseline: the median return of all priced cards from the same start dates.

export interface FlagReturn {
  date: string; // YYYY-MM-DD the card was flagged
  returnPct: number; // price N days later vs price when flagged
}

export interface TrackStats {
  n: number;
  medianPct: number | null;
  avgPct: number | null;
  pctUp: number | null; // share of flagged cards that rose
  baselinePct: number | null; // median return of ALL cards over the same windows (avg across the flag dates)
  excessPct: number | null; // median flagged return minus baseline: positive = flags beat the market
}

export const MIN_SAMPLE = 20; // below this the numbers are anecdotes; the page says so

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function summarizeFlagReturns(returns: FlagReturn[], baselineByDate: Map<string, number>): TrackStats {
  const finite = returns.filter((r) => Number.isFinite(r.returnPct));
  if (finite.length === 0) return { n: 0, medianPct: null, avgPct: null, pctUp: null, baselinePct: null, excessPct: null };
  const values = finite.map((r) => r.returnPct);
  const base = finite.map((r) => baselineByDate.get(r.date)).filter((b): b is number => b !== undefined);
  const medianPct = median(values);
  const baselinePct = base.length > 0 ? base.reduce((a, b) => a + b, 0) / base.length : null;
  return {
    n: finite.length,
    medianPct,
    avgPct: values.reduce((a, b) => a + b, 0) / values.length,
    pctUp: (values.filter((v) => v > 0).length / values.length) * 100,
    baselinePct,
    excessPct: medianPct !== null && baselinePct !== null ? medianPct - baselinePct : null,
  };
}

/** One plain sentence per result; hedged when the sample is small. */
export function describeTrackStats(tag: string, horizonDays: number, s: TrackStats): string {
  if (s.n === 0 || s.medianPct === null) return `No ${tag} flags are ${horizonDays} days old yet.`;
  const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
  const vs = s.excessPct === null ? "" : `, ${s.excessPct >= 0 ? "ahead of" : "behind"} the typical card (${sign(s.baselinePct!)}) by ${Math.abs(s.excessPct).toFixed(1)} points`;
  const caveat = s.n < MIN_SAMPLE ? ` Only ${s.n} flags so far — too few to draw conclusions.` : "";
  return `${s.n} ${tag} flags: median ${sign(s.medianPct)} after ${horizonDays} days, ${Math.round(s.pctUp ?? 0)}% rose${vs}.${caveat}`;
}
