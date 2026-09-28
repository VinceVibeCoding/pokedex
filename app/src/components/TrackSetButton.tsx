"use client";

// "Track every card in this set" — queues the whole set for the daily price job so its
// Sold History fills in. Signed-in only (the API 401s otherwise; this avoids the round trip).

import { useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";

export function TrackSetButton({ setCode, setName }: { setCode: string; setName: string }) {
  const { isSignedIn, isLoaded } = useUser();
  const [state, setState] = useState<{ status: "idle" | "saving" | "done" | "error"; message?: string }>({ status: "idle" });

  if (!isLoaded) return null;
  const cls = "self-start rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2";

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={cls}>Sign in to track all of {setName}</button>
      </SignInButton>
    );
  }
  if (state.status === "done") return <p className="self-center text-sm text-ink-2">{state.message}</p>;

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={state.status === "saving"}
        className={cls}
        onClick={async () => {
          setState({ status: "saving" });
          try {
            const res = await fetch("/api/sets/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ setCode }),
            });
            const data = (await res.json()) as { total?: number; newlyTracked?: number; error?: string };
            if (!res.ok) throw new Error(data.error ?? "Couldn't track that set.");
            setState({
              status: "done",
              message: `Tracking all ${data.total} cards in ${setName}${data.newlyTracked ? ` (${data.newlyTracked} new)` : " (already tracked)"}. Prices fill in over the next day or so.`,
            });
          } catch (err) {
            setState({ status: "error", message: err instanceof Error ? err.message : "Couldn't track that set." });
          }
        }}
      >
        {state.status === "saving" ? "Queuing…" : `Track all cards in ${setName}`}
      </button>
      {state.status === "error" && <p className="text-xs text-critical">{state.message}</p>}
    </div>
  );
}
