"use client";

// "Save this screen" on the screener: stores the current filters so you can get an alert when new
// cards match. Signed-in only (the API 401s otherwise; this avoids the round trip).

import { useState } from "react";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";

export function SaveScreenButton({ query }: { query: string }) {
  const { isSignedIn, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (!isLoaded || query === "") return null; // saving "all cards" alerts on nothing useful
  const cls = "rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2";

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={`${cls} self-start`}>Sign in to save this screen and get alerts</button>
      </SignInButton>
    );
  }
  if (state === "done") {
    return (
      <p className="text-sm text-ink-2">
        Saved. <Link href="/screens" className="text-accent hover:underline">View my screens →</Link>
      </p>
    );
  }
  if (!open) return <button onClick={() => setOpen(true)} className={`${cls} self-start`}>★ Save this screen</button>;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        try {
          const res = await fetch("/api/screens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, name }) });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Couldn't save that screen.");
          setState("done");
        } catch (err) {
          setState("error");
          setError(err instanceof Error ? err.message : "Couldn't save that screen.");
        }
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Name (optional)"
        aria-label="Screen name"
        className="h-9 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
      />
      <button disabled={state === "saving"} className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink">{state === "saving" ? "Saving…" : "Save"}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-3 hover:text-ink">Cancel</button>
      {state === "error" && <span className="text-xs text-critical">{error}</span>}
    </form>
  );
}
