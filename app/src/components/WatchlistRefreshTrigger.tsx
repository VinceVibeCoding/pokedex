"use client";

// Fires the opportunistic watchlist refresh (see /api/watchlist/refresh) once per
// mount, then does a single delayed router.refresh() to pick up anything that
// completed quickly. This is the page-view trigger that makes "near real-time"
// mean something — visiting your watchlist is what earns it a fresh look, the
// same pattern PriceStatus.tsx uses for a single card.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PICKUP_DELAY_MS = 4000;

export function WatchlistRefreshTrigger({ hasItems }: { hasItems: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !hasItems) return;
    started.current = true;
    fetch("/api/watchlist/refresh", { method: "POST" })
      .then((res) => {
        if (res.status === 202) setTimeout(() => router.refresh(), PICKUP_DELAY_MS);
      })
      .catch(() => {});
  }, [hasItems, router]);

  return null;
}
