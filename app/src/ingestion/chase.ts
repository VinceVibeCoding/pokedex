// Auto-track the cards that matter most. A tracked card gets sold-listing data (volume,
// real trends, eBay sales); the free API budgets (PokeTrace: 250 requests/day, each new card
// costs 2–3) only cover ~100 new cards a day, so we grow the tracked set gradually:
//   - "chase cards" = the PER_SET most valuable cards of every set (by TCGplayer market price)
//   - at most DAILY_ADD new ones per run, most valuable first
//   - paused while a backlog of never-fetched cards already exceeds BACKLOG_LIMIT, so the daily
//     job's budget is never spread over cards that will wait weeks (hand-tracked sets included).

import { getPrisma } from "../lib/prisma";

export const CHASE_PER_SET = 10;
export const CHASE_MIN_CENTS = 2000; // $20 — below this a % move is mostly noise
export const CHASE_DAILY_ADD = 40;
export const CHASE_BACKLOG_LIMIT = 150;

export async function autoTrackChaseCards(): Promise<{ added: number; skipped: "backlog" | "no-snapshot" | null }> {
  const prisma = getPrisma();
  const backlog = await prisma.trackedCard.count({ where: { lastRefreshedAt: null } });
  if (backlog >= CHASE_BACKLOG_LIMIT) return { added: 0, skipped: "backlog" };

  try {
    const added = await prisma.$executeRaw`
      INSERT INTO tracked_cards ("cardId")
      SELECT t.id FROM (
        SELECT s."cardId" AS id, s."tcgMarketCents" AS m,
               row_number() OVER (PARTITION BY c."setCode" ORDER BY s."tcgMarketCents" DESC) AS rn
        FROM card_price_snapshots s
        JOIN cards c ON c.id = s."cardId"
        WHERE s.date = (SELECT max(date) FROM card_price_snapshots) AND s."tcgMarketCents" >= ${CHASE_MIN_CENTS}
      ) t
      WHERE t.rn <= ${CHASE_PER_SET} AND NOT EXISTS (SELECT 1 FROM tracked_cards tc WHERE tc."cardId" = t.id)
      ORDER BY t.m DESC
      LIMIT ${CHASE_DAILY_ADD}
      ON CONFLICT DO NOTHING
    `;
    return { added, skipped: null };
  } catch {
    return { added: 0, skipped: "no-snapshot" }; // snapshot table missing/empty: nothing to rank by
  }
}
