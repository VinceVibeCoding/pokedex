import type { Metadata } from "next";
import Link from "next/link";
import { CardThumb } from "@/components/CardThumb";
import { getMarketNews } from "@/serving/news";

export const metadata: Metadata = { title: "News" };
export const dynamic = "force-dynamic";

const TAG_COLOR = { Index: "var(--accent)", Gainer: "var(--good)", Loser: "var(--critical)" } as const;

export default async function NewsPage() {
  const items = await getMarketNews();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market News</h1>
        <p className="mt-1 text-ink-2">Headlines generated from our own price data — every item links to the numbers behind it.</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">Not enough price history yet to report on the market.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 hover:border-ink-3">
                {n.imageUrl && <CardThumb src={n.imageUrl} alt="" width={56} />}
                <div className="min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: TAG_COLOR[n.tag] }}>{n.tag}</span>
                  <h2 className="font-medium">{n.headline}</h2>
                  <p className="mt-1 text-sm text-ink-2">{n.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
