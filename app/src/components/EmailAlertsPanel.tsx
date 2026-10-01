"use client";

// "Email alerts" page inside the Clerk profile modal (avatar → Manage account). Lists the user's
// saved screens with an on/off switch each, plus a one-press "unsubscribe from all".

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

interface Screen {
  id: string;
  name: string;
  notifyEmail: boolean;
}

export function EmailAlertsPanel() {
  const { user } = useUser();
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  // Loads on mount and again whenever a change bumps reloadKey. State is set from the promise
  // callbacks (not synchronously in the effect), and a stale response is ignored on unmount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/screens")
      .then((res) => (res.ok ? (res.json() as Promise<{ screens: Screen[] }>) : Promise.reject(new Error("load failed"))))
      .then((data) => {
        if (!cancelled) setScreens(data.screens);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your alerts.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function patch(body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/screens", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      setReloadKey((k) => k + 1);
    } catch {
      setError("That didn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  const email = user?.primaryEmailAddress?.emailAddress;
  const activeCount = screens?.filter((s) => s.notifyEmail).length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Email alerts</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.7 }}>
          One daily email listing cards that newly match your saved screens{email ? <>, sent to <strong>{email}</strong></> : null}. Nothing is sent on days with no new matches.
        </p>
      </div>

      {screens === null && !error && <p style={{ opacity: 0.7 }}>Loading…</p>}
      {error && <p style={{ color: "#d03b3b" }}>{error}</p>}

      {screens !== null && screens.length === 0 && (
        <p style={{ opacity: 0.7 }}>You haven&apos;t saved any screens yet. Save a filter from the Screener page to get alerts.</p>
      )}

      {screens !== null && screens.length > 0 && (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {screens.map((s) => (
              <li key={s.id}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={s.notifyEmail} disabled={busy} onChange={(e) => patch({ id: s.id, notifyEmail: e.target.checked })} />
                  <span>{s.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <button
              disabled={busy || activeCount === 0}
              onClick={() => patch({ all: true, notifyEmail: false })}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid currentColor", opacity: busy || activeCount === 0 ? 0.5 : 1, cursor: activeCount === 0 ? "default" : "pointer", background: "transparent", color: "inherit" }}
            >
              {activeCount === 0 ? "You're not subscribed to any alerts" : "Unsubscribe from all alert emails"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
