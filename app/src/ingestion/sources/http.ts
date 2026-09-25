// HTTP for the price APIs: per-source request spacing, timeout, bounded retries on
// network/5xx, and careful 429 handling (honour Retry-After for per-minute limits;
// stop for the day on daily limits — retrying those cannot succeed).

import { ensureQuota, markExhausted, nextUtcMidnight, recordUsage, type QuotaSource } from "./quota";

export class ApiError extends Error {
  constructor(
    public readonly source: QuotaSource,
    public readonly status: number,
    message: string,
  ) {
    super(`[${source}] ${message}`);
    this.name = "ApiError";
  }
}

const lastRequestAt = new Map<QuotaSource, number>();

async function spaceRequests(source: QuotaSource, minIntervalMs: number) {
  const wait = (lastRequestAt.get(source) ?? 0) + minIntervalMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt.set(source, Date.now());
}

export interface ApiRequest {
  source: QuotaSource;
  url: string;
  headers: Record<string, string>;
  cost: number; // credits/requests this call spends against the daily budget
  minIntervalMs: number; // provider burst limit, e.g. PokeTrace free = 1 req / 2s
  /** Reads the provider's "remaining today" header, if it has one. */
  remainingHeader?: string;
  timeoutMs?: number;
}

/** GET + parse JSON. Throws QuotaExhaustedError or ApiError; never loops on 429s. */
export async function getJson<T>(req: ApiRequest): Promise<T> {
  await ensureQuota(req.source, req.cost);

  for (let attempt = 0; ; attempt++) {
    await spaceRequests(req.source, req.minIntervalMs);
    let res: Response;
    try {
      res = await fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(req.timeoutMs ?? 15_000) });
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new ApiError(req.source, 0, `network error: ${(err as Error).message}`);
    }

    const remainingRaw = req.remainingHeader ? res.headers.get(req.remainingHeader) : null;
    const remaining = remainingRaw !== null && remainingRaw !== "" ? Number(remainingRaw) : null;

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "0");
      const body = (await res.json().catch(() => ({}))) as { limitType?: string };
      // Daily limit (explicit, or a Retry-After too long to be a burst limit): stop for today.
      if (body.limitType === "daily" || retryAfter > 120) {
        await markExhausted(req.source, retryAfter > 120 ? new Date(Date.now() + retryAfter * 1000) : nextUtcMidnight());
        throw new ApiError(req.source, 429, "daily limit reached — stopping until reset");
      }
      // Burst limit: wait once, then give up on this call (repeated 429s risk a key block).
      if (attempt >= 1) throw new ApiError(req.source, 429, "rate limited twice in a row — try again later");
      await new Promise((r) => setTimeout(r, Math.max(retryAfter, 2) * 1000));
      continue;
    }

    // Every non-429 response counts against the budget.
    await recordUsage(req.source, req.cost, Number.isFinite(remaining) ? remaining : null);

    if (res.status >= 500 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(req.source, res.status, `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
}
