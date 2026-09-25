"use client";

// True failures only (database down, etc.). Missing price data is NOT an error —
// it renders as an "insufficient data" state inside the card view.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl pt-[10vh] text-center">
      <h1 className="text-xl font-semibold">Lookup is temporarily unavailable</h1>
      <p className="mt-2 text-ink-2">The price database didn&apos;t respond. This is on our side, not your search.</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
        Try again
      </button>
    </div>
  );
}
