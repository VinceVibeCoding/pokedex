import type { Metadata } from "next";
import Link from "next/link";
import { CardSearch } from "@/components/CardSearch";
import { CardThumb } from "@/components/CardThumb";
import { PAGE_SIZE, searchCardsPage } from "@/serving/search";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { results, total } = q ? await searchCardsPage(q, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }) : { results: [], total: 0 };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => `/search?q=${encodeURIComponent(q)}${n > 1 ? `&page=${n}` : ""}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-2xl">
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">{q ? `Results for “${q}”` : "Search all cards"}</h1>
        <CardSearch size="md" />
      </div>
      {q && (
        <p className="text-sm text-ink-2">
          {total === 0 ? "No cards match." : `${total.toLocaleString()} card${total === 1 ? "" : "s"} · page ${page} of ${pages}`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {results.map((c) => (
          <Link
            key={c.id}
            href={`/card/${encodeURIComponent(c.id)}`}
            className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-ink-3"
          >
            <div className="flex justify-center bg-surface-2 py-3">
              <CardThumb src={c.imageUrl} alt={c.name} width={104} />
            </div>
            <div className="p-2.5">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-xs text-ink-3">
                {c.setName}
                {c.number ? ` · #${c.number}` : ""}
              </div>
              <div className="truncate text-xs text-ink-3">
                {c.releaseDate.slice(0, 4)} · {c.rarity}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">← Previous</Link> : <span />}
          {page < pages && <Link href={pageHref(page + 1)} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
