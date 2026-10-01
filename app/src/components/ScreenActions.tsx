"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Per-screen controls: email alerts on/off and delete. */
export function ScreenActions({ id, notifyEmail }: { id: string; notifyEmail: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(init: RequestInit, url = "/api/screens") {
    setBusy(true);
    try {
      await fetch(url, init);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="flex cursor-pointer items-center gap-1.5 text-ink-2">
        <input
          type="checkbox"
          checked={notifyEmail}
          disabled={busy}
          onChange={(e) => call({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, notifyEmail: e.target.checked }) })}
        />
        Email me new matches
      </label>
      <button
        disabled={busy}
        onClick={() => confirm("Delete this saved screen?") && call({ method: "DELETE" }, `/api/screens?id=${encodeURIComponent(id)}`)}
        className="text-ink-3 hover:text-critical"
      >
        Delete
      </button>
    </div>
  );
}
