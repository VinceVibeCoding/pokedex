"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CardThumb } from "./CardThumb";
import { readRecent, RECENT_KEY, type RecentCard } from "@/lib/recent";

const EMPTY: RecentCard[] = [];
let cached: { raw: string | null; cards: RecentCard[] } = { raw: null, cards: EMPTY };

// Snapshot must be referentially stable between calls, so memoize on the raw string.
function getSnapshot(): RecentCard[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cached.raw) cached = { raw, cards: readRecent() };
  return cached.cards;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function RecentCards() {
  const cards = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  if (cards.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium text-ink-2">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/card/${encodeURIComponent(c.id)}`}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2 hover:bg-surface-2"
          >
            <CardThumb src={c.imageUrl} alt="" width={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-xs text-ink-2">
                {c.setName}
                {c.number ? ` · #${c.number}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
