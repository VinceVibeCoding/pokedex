"use client";

import { useState } from "react";

/** Confirm step for the email link: a POST, so mail scanners that pre-fetch links can't unsubscribe anyone. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p className="text-ink-2">You&apos;re unsubscribed — no more alert emails. You can turn alerts back on any time from your profile.</p>;
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        disabled={state === "busy"}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        onClick={async () => {
          setState("busy");
          try {
            const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
            setState(res.ok ? "done" : "error");
          } catch {
            setState("error");
          }
        }}
      >
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe from all alert emails"}
      </button>
      {state === "error" && <p className="text-sm text-critical">That didn&apos;t work — try again, or turn alerts off in your profile.</p>}
    </div>
  );
}
