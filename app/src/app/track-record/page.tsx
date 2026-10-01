import type { Metadata } from "next";
import { formatPct } from "@/lib/format";
import { MIN_SAMPLE } from "@/analysis/trackRecord";
import { getTrackRecord } from "@/serving/trackRecord";

export const metadata: Metadata = { title: "Track record" };
export const dynamic = "force-dynamic";

const TAG_LABEL = { trending: "Trending up", undervalued: "Possibly undervalued" } as const;
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export default async function TrackRecordPage() {
  const rec = await getTrackRecord();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Track record</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          Is the screener any good? Every day we log which cards it flags, with the price at that moment. This page compares that price with the price a week and a month later — and against the typical card over the same days, because in a rising market everything goes up.
        </p>
      </div>

      {rec === null || rec.flagDays === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          Logging has not started yet. Once the first daily snapshot finishes, flags are recorded here and the first 7-day results appear a week later.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-3">
            Flags logged on {rec.flagDays} day{rec.flagDays === 1 ? "" : "s"}, {rec.firstFlagDate} to {rec.lastFlagDate}. First 7-day results {rec.results.every((r) => r.stats.n === 0) ? `expected from ${addDays(rec.firstFlagDate!, 7)}` : "are in"}.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {rec.results.map((r) => (
              <section key={`${r.tag}-${r.horizon}`} className="rounded-xl border border-line bg-surface p-4">
                <h2 className="text-sm font-medium text-ink-2">{TAG_LABEL[r.tag]} · after {r.horizon} days</h2>
                {r.stats.n === 0 ? (
                  <p className="mt-2 text-sm text-ink-3">{r.summary}</p>
                ) : (
                  <>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="tabular text-3xl font-semibold" style={{ color: (r.stats.medianPct ?? 0) >= 0 ? "var(--good)" : "var(--critical)" }}>
                        {formatPct(r.stats.medianPct ?? 0, 1)}
                      </span>
                      <span className="text-sm text-ink-3">median · {r.stats.n} flags</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div><dt className="text-xs text-ink-3">Rose</dt><dd className="tabular">{Math.round(r.stats.pctUp ?? 0)}%</dd></div>
                      <div><dt className="text-xs text-ink-3">Typical card</dt><dd className="tabular">{r.stats.baselinePct === null ? "—" : formatPct(r.stats.baselinePct, 1)}</dd></div>
                      <div><dt className="text-xs text-ink-3">vs typical</dt><dd className="tabular font-semibold" style={{ color: (r.stats.excessPct ?? 0) >= 0 ? "var(--good)" : "var(--critical)" }}>{r.stats.excessPct === null ? "—" : `${r.stats.excessPct >= 0 ? "+" : ""}${r.stats.excessPct.toFixed(1)} pts`}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-ink-2">{r.summary}</p>
                  </>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <details className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">How this is measured — and its limits</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Return = the card&apos;s TCGplayer market price exactly N days after it was flagged, versus the price logged when flagged. The log is append-only, so past flags can&apos;t be edited.</li>
          <li>&quot;Typical card&quot; = the median return of every card priced at $3+ over the same start dates.</li>
          <li>Fewer than {MIN_SAMPLE} flags is shown as too few to conclude anything. Early numbers will swing a lot.</li>
          <li>Market prices aren&apos;t what you&apos;d pay: they ignore fees, shipping, condition and the spread between listing and sale.</li>
          <li>This measures the screener, not advice. A good record doesn&apos;t mean the next flag will work.</li>
        </ul>
      </details>
    </div>
  );
}
