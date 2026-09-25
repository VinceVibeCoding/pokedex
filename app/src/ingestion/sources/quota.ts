// Daily API budgets for the free tiers, shared by every process (web server + cron)
// through the source_quotas table. We stop BEFORE a daily limit instead of
// collecting 429s — both providers temporarily block keys that pile up 429s.

import { getPrisma } from "../../lib/prisma";

export type QuotaSource = "pokemonpricetracker" | "poketrace";

/** Free-tier daily allowances. Override with env if you upgrade a plan. */
export const DAILY_LIMITS: Record<QuotaSource, number> = {
  pokemonpricetracker: Number(process.env.PPT_DAILY_CREDITS ?? 100),
  poketrace: Number(process.env.POKETRACE_DAILY_REQUESTS ?? 250),
};

export class QuotaExhaustedError extends Error {
  constructor(
    public readonly source: QuotaSource,
    public readonly resetsAt: Date,
  ) {
    super(`${source} daily limit reached — resets ${resetsAt.toISOString()}`);
    this.name = "QuotaExhaustedError";
  }
}

function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextUtcMidnight(now: Date = new Date()): Date {
  return new Date(utcDay(now).getTime() + 24 * 60 * 60 * 1000);
}

async function current(source: QuotaSource, now: Date) {
  const prisma = getPrisma();
  const day = utcDay(now);
  const row = await prisma.sourceQuota.findUnique({ where: { source } });
  if (row && row.day.getTime() === day.getTime()) return row;
  // New UTC day (or first use): counters reset.
  return prisma.sourceQuota.upsert({
    where: { source },
    create: { source, day },
    update: { day, used: 0, remaining: null, exhaustedUntil: null },
  });
}

/** Throws QuotaExhaustedError if spending `cost` now would exceed today's budget. */
export async function ensureQuota(source: QuotaSource, cost: number, now: Date = new Date()): Promise<void> {
  const row = await current(source, now);
  if (row.exhaustedUntil && row.exhaustedUntil > now) throw new QuotaExhaustedError(source, row.exhaustedUntil);
  const remaining = row.remaining ?? DAILY_LIMITS[source] - row.used;
  if (remaining < cost) throw new QuotaExhaustedError(source, nextUtcMidnight(now));
}

/** Records spend; `reportedRemaining` comes from the provider's headers when it sends them. */
export async function recordUsage(
  source: QuotaSource,
  cost: number,
  reportedRemaining: number | null,
  now: Date = new Date(),
): Promise<void> {
  await current(source, now);
  await getPrisma().sourceQuota.update({
    where: { source },
    data: {
      used: { increment: cost },
      ...(reportedRemaining !== null ? { remaining: reportedRemaining } : {}),
    },
  });
}

export async function markExhausted(source: QuotaSource, until: Date, now: Date = new Date()): Promise<void> {
  await current(source, now);
  await getPrisma().sourceQuota.update({ where: { source }, data: { exhaustedUntil: until, remaining: 0 } });
}

/** For the UI/CLI: how much of today's budget is left. */
export async function quotaStatus(source: QuotaSource, now: Date = new Date()) {
  const row = await current(source, now);
  const exhausted = row.exhaustedUntil !== null && row.exhaustedUntil > now;
  return {
    source,
    used: row.used,
    remaining: exhausted ? 0 : (row.remaining ?? DAILY_LIMITS[source] - row.used),
    limit: DAILY_LIMITS[source],
  };
}
