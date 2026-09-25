import { CardSearch } from "@/components/CardSearch";
import { RecentCards } from "@/components/RecentCards";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl pt-[12vh]">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What&apos;s this card worth?</h1>
      <p className="mt-2 text-ink-2">
        Fair price, the most you should pay, and raw vs PSA 8 / 9 / 10 — in one search.
      </p>
      <div className="mt-6">
        <CardSearch autoFocus />
      </div>
      <p className="mt-3 text-sm text-ink-3">
        Search by name, set, or number as printed. Press <kbd className="rounded border border-line px-1">/</kbd> anywhere to search.
      </p>
      <RecentCards />
    </div>
  );
}
