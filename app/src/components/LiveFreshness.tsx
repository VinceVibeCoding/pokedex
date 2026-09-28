"use client";

// The honest "live" indicator: prices don't actually change every minute (see
// README "How prices actually update"), but this label re-renders every 60s so
// staleness is always visible at a glance rather than frozen at page-load time.
// useSyncExternalStore (same pattern as RecentCards.tsx) rather than
// useState+useEffect: the snapshot is a pure read of the clock, and the
// dedicated server-snapshot slot avoids a hydration mismatch without ever
// calling setState synchronously inside an effect body.

import { useSyncExternalStore } from "react";
import { formatFreshness } from "@/lib/format";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function label(at: string | null, prefix: string): string {
  return at ? `${prefix} ${formatFreshness(at)}` : "No price data collected yet";
}

export function LiveFreshness({ at, prefix = "Prices updated" }: { at: string | null; prefix?: string }) {
  const text = useSyncExternalStore(subscribe, () => label(at, prefix), () => label(at, prefix));
  return <>{text}</>;
}
