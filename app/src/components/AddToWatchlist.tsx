"use client";

// "I own this" control on the card page — logs quantity + price paid against the
// currently selected grade tier so the watchlist can compute live P&L. Signed-out
// visitors get a sign-in prompt instead of the form (the API 401s anyway; this
// just avoids a round trip).

import { useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { GRADE_LABELS } from "@/lib/grade";
import type { GradeTier } from "@/types/domain";

export function AddToWatchlist({
  cardId,
  tier,
  priceCents,
}: {
  cardId: string;
  tier: GradeTier;
  priceCents: number | null;
}) {
  const { isSignedIn, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pricePaid, setPricePaid] = useState(priceCents !== null ? (priceCents / 100).toFixed(2) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="self-start rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
          Sign in to track this card in your watchlist
        </button>
      </SignInButton>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
      >
        + Add to my watchlist ({GRADE_LABELS[tier]})
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          gradeTier: tier,
          quantity,
          acquiredPriceCents: pricePaid.trim() ? Math.round(parseFloat(pricePaid) * 100) : null,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-ink-2">
        Added to your watchlist. <a href="/watchlist" className="text-accent hover:underline">View watchlist →</a>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
      <div>
        <label className="block text-xs text-ink-2" htmlFor="wl-qty">Quantity</label>
        <input
          id="wl-qty"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          className="mt-1 h-8 w-20 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-2" htmlFor="wl-price">Price paid (each)</label>
        <input
          id="wl-price"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={pricePaid}
          onChange={(e) => setPricePaid(e.target.value)}
          className="mt-1 h-8 w-28 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-8 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : `Save ${GRADE_LABELS[tier]}`}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-8 text-sm text-ink-2 hover:underline">
        Cancel
      </button>
      {status === "error" && <p className="w-full text-xs" style={{ color: "var(--critical)" }}>Couldn&apos;t save — try again.</p>}
    </form>
  );
}
