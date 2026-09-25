// Recently viewed cards — per-browser convenience only, so localStorage is fine.
// Every access is guarded: storage can be unavailable (private mode, blocked).

import type { CardSearchResult } from "../types/domain";

export const RECENT_KEY = "card-index:recent";
const MAX = 8;

export type RecentCard = Pick<CardSearchResult, "id" | "name" | "setName" | "number" | "imageUrl">;

export function readRecent(): RecentCard[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentCard[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(card: RecentCard): void {
  try {
    const next = [card, ...readRecent().filter((c) => c.id !== card.id)].slice(0, MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // not fatal
  }
}
