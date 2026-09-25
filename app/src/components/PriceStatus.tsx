"use client";

// Live-price status for a card, and the trigger that keeps viewed cards fresh.
// On view: if the card has never been fetched, or its prices are older than
// STALE_MS, ask the server to refresh it (the server throttles and budgets this),
// poll until the fetch finishes, then re-render the page with the new prices.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CardLookupResponse, TrackingStatus } from "@/types/domain";

const STALE_MS = 20 * 60 * 60 * 1000; // sources update once a day
const POLL_MS = 2500;
const POLL_GIVE_UP_MS = 90_000;

function needsRefresh(t: TrackingStatus, now: number): boolean {
  if (!t.sourcesConfigured || t.fetching || t.mappingError) return false;
  return !t.lastRefreshedAt || now - Date.parse(t.lastRefreshedAt) > STALE_MS;
}

export function PriceStatus({ cardId, tracking }: { cardId: string; tracking: TrackingStatus }) {
  const router = useRouter();
  const [fetching, setFetching] = useState(tracking.fetching);
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(false);

  // Kick off a refresh once per page view when prices are missing or stale.
  useEffect(() => {
    if (started.current || !needsRefresh(tracking, Date.now())) return;
    started.current = true;
    fetch(`/api/cards/${encodeURIComponent(cardId)}/refresh`, { method: "POST" })
      .then((res) => {
        if (res.status === 202) setFetching(true);
      })
      .catch(() => {});
  }, [cardId, tracking]);

  // While a fetch runs, poll the lookup until it's done, then re-render with fresh data.
  useEffect(() => {
    if (!fetching) return;
    const startedAt = Date.now();
    let cancelled = false;
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
        clearInterval(timer);
        setFetching(false);
        setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}`, { cache: "no-store" });
        const body = (await res.json()) as CardLookupResponse;
        if (!cancelled && !body.tracking.fetching) {
          clearInterval(timer);
          setFetching(false);
          router.refresh();
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetching, cardId, router]);

  let message: string | null = null;
  let tone: "info" | "warn" = "info";
  if (fetching) {
    message = tracking.lastRefreshedAt
      ? "Updating prices…"
      : "Fetching live prices for this card — the first lookup takes about 10 seconds.";
  } else if (timedOut) {
    message = "Price update is taking longer than expected. Refresh the page in a minute.";
    tone = "warn";
  } else if (!tracking.sourcesConfigured) {
    message = "Live prices are off: add POKETRACE_API_KEY and POKEMONPRICETRACKER_API_KEY to app/.env.";
    tone = "warn";
  } else if (tracking.mappingError) {
    message = "Couldn't match this card on the price source, so there are no live prices for it yet.";
    tone = "warn";
  } else if (tracking.lastError?.includes("limit")) {
    message = "Today's free API limit is used up. Prices refresh after midnight UTC.";
    tone = "warn";
  } else if (tracking.lastError) {
    message = "The last price update had a problem — showing the most recent data we have.";
    tone = "warn";
  }
  if (!message) return null;

  const details = tracking.mappingError ?? (message.startsWith("The last") ? tracking.lastError : null);
  return (
    <div
      role="status"
      className="rounded-xl border px-3 py-2 text-sm"
      style={{
        borderColor: tone === "warn" ? "var(--warning)" : "var(--border)",
        background: tone === "warn" ? "color-mix(in oklab, var(--warning) 10%, var(--surface))" : "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2">
        {fetching ? (
          <span aria-hidden className="inline-block size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        ) : (
          <span aria-hidden style={{ color: "var(--warning)" }}>
            ●
          </span>
        )}
        <span>{message}</span>
      </div>
      {details && (
        <details className="mt-1 text-xs text-ink-2">
          <summary className="cursor-pointer">Details</summary>
          <p className="mt-1 break-words">{details}</p>
        </details>
      )}
    </div>
  );
}
