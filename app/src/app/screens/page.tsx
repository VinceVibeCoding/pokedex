import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { CardThumb } from "@/components/CardThumb";
import { ScreenActions } from "@/components/ScreenActions";
import { formatCents, formatPct } from "@/lib/format";
import { getPrisma } from "@/lib/prisma";
import { DIGEST_TOP } from "@/ingestion/digest";
import { getScreener } from "@/serving/screener";
import { paramsFromQuery, parseScreenerParams } from "@/serving/screenerParams";

export const metadata: Metadata = { title: "My screens" };
export const dynamic = "force-dynamic";

export default async function ScreensPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/screens");

  const screens = await getPrisma().savedScreen.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const results = await Promise.all(screens.map((s) => getScreener({ ...parseScreenerParams(paramsFromQuery(s.query)), pageSize: DIGEST_TOP })));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My screens</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          Filters you saved from the <Link href="/screener" className="text-accent hover:underline">screener</Link>. Turn on email alerts and you&apos;ll get one daily email listing only the cards that started matching since the last one.
        </p>
      </div>

      {screens.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          Nothing saved yet. Set up a filter in the <Link href="/screener" className="text-accent hover:underline">screener</Link> — for example, trending cards in one set under $50 — and press “Save this screen”.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {screens.map((s, i) => {
            const res = results[i];
            const seen = new Set(s.lastMatchIds);
            const fresh = res.rows.filter((r) => !seen.has(r.cardId));
            return (
              <li key={s.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{s.name}</h2>
                    <p className="text-xs text-ink-3">
                      {res.total.toLocaleString()} match now{fresh.length > 0 ? <> · <span className="font-semibold text-accent">{fresh.length} new since your last alert</span></> : null}
                      {s.lastEmailedAt ? ` · last emailed ${s.lastEmailedAt.toISOString().slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScreenActions id={s.id} notifyEmail={s.notifyEmail} />
                    <Link href={`/screener${s.query ? `?${s.query}` : ""}`} className="text-xs text-accent hover:underline">Open in screener →</Link>
                  </div>
                </div>
                {res.rows.length > 0 && (
                  <ul className="mt-3 flex flex-col divide-y divide-line">
                    {res.rows.slice(0, 5).map((r) => (
                      <li key={r.cardId}>
                        <Link href={`/card/${encodeURIComponent(r.cardId)}`} className="flex items-center gap-3 py-2 hover:bg-surface-2">
                          <CardThumb src={r.imageUrl} alt="" width={28} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{r.name} {!seen.has(r.cardId) && <span className="ml-1 rounded-full border border-accent px-1.5 text-[10px] text-accent">new</span>}</div>
                            <div className="truncate text-xs text-ink-3">{r.reasons[0] ?? r.setName}</div>
                          </div>
                          <div className="tabular text-sm font-semibold">{formatCents(r.priceCents)}</div>
                          {r.trendPct !== null && <div className="tabular w-16 text-right text-xs font-semibold" style={{ color: r.trendPct >= 0 ? "var(--good)" : "var(--critical)" }}>{formatPct(r.trendPct, 1)}</div>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
