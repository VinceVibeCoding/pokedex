// Redis cache for lookup responses — keyed by card ID, short TTL.
// Degrades gracefully: if Redis is unreachable, lookups hit the DB directly
// (slower, but the serving plane never goes down because of the cache).

import { createClient, type RedisClientType } from "redis";

const TTL_SECONDS = 300; // 5 min — keyed to ingestion freshness
const KEY_PREFIX = "lookup:v3:"; // bump the version whenever CardSnapshot changes shape

const globalForRedis = globalThis as unknown as {
  redis?: RedisClientType;
};

/**
 * Never blocks a lookup on Redis. The client connects (and keeps reconnecting) in
 * the background; until it's ready, callers skip the cache. Awaiting connect() is
 * not an option: with a reconnect strategy it never settles while Redis is down.
 * disableOfflineQueue makes commands fail fast instead of queueing during an outage.
 */
function readyClient(): RedisClientType | null {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
      disableOfflineQueue: true,
      socket: { connectTimeout: 1000, reconnectStrategy: (retries) => Math.min(retries * 200, 5000) },
    });
    globalForRedis.redis.on("error", () => {}); // swallow — degrade to DB
    globalForRedis.redis.connect().catch(() => {});
  }
  return globalForRedis.redis.isReady ? globalForRedis.redis : null;
}

export async function cacheGet<T>(cardId: string): Promise<T | null> {
  try {
    const redis = readyClient();
    if (!redis) return null;
    const raw = await redis.get(KEY_PREFIX + cardId);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(cardId: string, value: unknown): Promise<void> {
  try {
    const redis = readyClient();
    if (!redis) return;
    await redis.set(KEY_PREFIX + cardId, JSON.stringify(value), {
      EX: TTL_SECONDS,
    });
  } catch {
    // cache write failure is not fatal
  }
}

/** Called by ingestion after new prices land, so the next lookup rebuilds. */
export async function cacheDelete(cardId: string): Promise<void> {
  try {
    const redis = readyClient();
    if (!redis) return;
    await redis.del(KEY_PREFIX + cardId);
  } catch {
    // not fatal — the entry expires with its TTL
  }
}
