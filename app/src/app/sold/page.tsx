import type { Metadata } from "next";
import Link from "next/link";
import { CardThumb } from "@/components/CardThumb";
import { IndexChart } from "@/components/IndexChart";
import { formatCents, formatDate, formatPct } from "@/lib/format";
import { GRADE_LABELS, GRADE_TIERS, isGradeTier } from "@/lib/grade";
import { FEED_PAGE_SIZE, getSoldFeed, SOLD_SOURCES, SOURCE_SHORT_LABELS, type SoldGroup, type SoldSort } from "@/serving/sold";

export const metadata: Metadata = { title: "Sold History" };
export const dynamic = "force-dynamic";

type Params = { grade?: string; sort?: string; source?: string; q?: string; min?: string; max?: string; days?: string; set?: string; page?: string };

const DAY_OPTIONS = [
  { value: "", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const dollarsToCents = (v: string | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export default async function SoldPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const grade = isGradeTier(sp.grade) ? sp.grade : null;
  const sort: SoldSort = sp.sort === "price" ? "price" : "recent";
  const source = SOLD_SOURCES.find((x) => x === sp.source) ?? null;
  const q = (sp.q ?? "").trim();
  const minCents = dollarsToCents(sp.min);
  const maxCents = dollarsToCents(sp.max);
  const days = DAY_OPTIONS.some((d) => d.value === sp.days && d.value !== "") ? Number(sp.days) : null;
  const set = sp.set?.trim() || null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { groups, total, sets } = await getSoldFeed({ grade, sort, q, source, minCents, maxCents, days, set, page });
  const pages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));

  // Every link keeps the other filters; `over` changes one (null clears it). Filter links omit `page`, so they reset to page 1.
  const current: Record<string, string | null> = {
    grade, sort: sort === "recent" ? null : sort, source, q: q || null, min: sp.min || null, max: sp.max || null, days: days ? String(days) : null, set,
  };
  const href = (over: Record<string, string | null> = {}) => {
    const merged = { ...current, ...over };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/sold?${qs}` : "/sold";
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line text-ink-2 hover:text-ink"}`;
  const field = "h-10 rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sold History</h1>
        <p className="mt-1 text-ink-2">
          Every card and grade that has sold, with its price history. Prices are each day&apos;s average sale price; eBay comes through two providers, so the same sale can appear twice in the last-sales list.
        </p>
      </div>

      <form action="/sold" className="flex flex-wrap items-center gap-2">
        {grade && <input type="hidden" name="grade" value={grade} />}
        {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
        {source && <input type="hidden" name="source" value={source} />}
        <input type="search" name="q" defaultValue={q} placeholder="Search — e.g. jungle, snorlax, 199/165" aria-label="Search sold history" className={`${field} min-w-[14rem] flex-1`} />
        <input type="number" name="min" min={0} step="any" defaultValue={sp.min ?? ""} placeholder="Min $" aria-label="Minimum price" className={`${field} w-24`} />
        <input type="number" name="max" min={0} step="any" defaultValue={sp.max ?? ""} placeholder="Max $" aria-label="Maximum price" className={`${field} w-24`} />
        <select name="days" defaultValue={days ? String(days) : ""} aria-label="Date sold" className={field}>
          {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select name="set" defaultValue={set ?? ""} aria-label="Set" className={`${field} max-w-[12rem]`}>
          <option value="">All sets</option>
          {sets.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">Apply</button>
        <Link href={href({ q: null, min: null, max: null, days: null, set: null })} className="px-1 text-sm text-ink-2 hover:text-ink">Reset</Link>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ grade: null })} className={pill(grade === null)}>All grades</Link>
        {GRADE_TIERS.map((g) => <Link key={g} href={href({ grade: g })} className={pill(grade === g)}>{GRADE_LABELS[g]}</Link>)}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={href({ sort: null })} className={pill(sort === "recent")}>Recently sold</Link>
        <Link href={href({ sort: "price" })} className={pill(sort === "price")}>Highest price</Link>
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={href({ source: null })} className={pill(source === null)}>All sources</Link>
        {SOLD_SOURCES.map((x) => <Link key={x} href={href({ source: x })} className={pill(source === x)}>{SOURCE_SHORT_LABELS[x]}</Link>)}
      </div>

      <p className="text-sm text-ink-3">{total.toLocaleString()} card{total === 1 ? "" : "s"} with sales{total > 0 ? ` · page ${page} of ${pages}` : ""}</p>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          {q || set || minCents !== null || maxCents !== null || days || grade || source
            ? "No sold cards match these filters."
            : "No sales recorded yet. Sales appear for a card once it has been looked up and its prices fetched."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {groups.map((g) => <SoldRow key={`${g.cardId}:${g.gradeTier}`} g={g} />)}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href({ page: page - 1 > 1 ? String(page - 1) : null })} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">← Previous</Link> : <span />}
          {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">Next →</Link>}
        </nav>
      )}
    </div>
  );
}

function SoldRow({ g }: { g: SoldGroup }) {
  const up = g.vsLastPct !== null && g.vsLastPct >= 0;
  return (
    <li className="grid gap-4 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,20rem)] lg:items-center">
      <Link href={`/card/${encodeURIComponent(g.cardId)}?grade=${g.gradeTier}`} className="flex gap-3">
        <div className="rounded-xl border border-line bg-surface-2 p-2">
          <CardThumb src={g.imageUrl} alt={g.cardName} width={72} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight hover:underline">
            {g.cardName}
            {g.number ? <span className="text-ink-2"> #{g.number.split("/")[0]}</span> : null}
          </h2>
          <div className="text-sm text-ink-2">{g.setName}</div>
          <span className="mt-1 inline-block rounded-md border border-line px-2 py-0.5 text-xs font-semibold">{GRADE_LABELS[g.gradeTier]}</span>
          <div className="mt-1 text-xs text-ink-3">Sold {formatDate(g.latest.date)}</div>
          <div className="tabular text-2xl font-bold">{formatCents(g.latest.priceCents)}</div>
          {g.vsLastPct !== null && (
            <div className="tabular text-xs font-semibold" style={{ color: up ? "var(--good)" : "var(--critical)" }}>
              {up ? "▲" : "▼"} {formatPct(g.vsLastPct, 2)} <span className="font-normal text-ink-3">vs last sale</span>
            </div>
          )}
        </div>
      </Link>

      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-1 flex justify-between text-xs text-ink-3">
          <span>Price history</span>
          <span>{g.totalSales.toLocaleString()} sale{g.totalSales === 1 ? "" : "s"} · {SOURCE_SHORT_LABELS[g.latest.source]}</span>
        </div>
        <IndexChart points={g.history} baseline={null} height={96} label={`${g.cardName} ${GRADE_LABELS[g.gradeTier]} price history, ${g.history.length} sale days, latest ${formatCents(g.latest.priceCents)}`} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-3 text-sm">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">Last sales</div>
        <table className="w-full">
          <thead className="text-xs text-ink-3">
            <tr><th className="text-left font-normal">Date</th><th className="text-left font-normal">Marketplace</th><th className="text-right font-normal">Price</th></tr>
          </thead>
          <tbody>
            {g.lastSales.map((s) => (
              <tr key={`${s.date}:${s.source}`} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{formatDate(s.date)}</td>
                <td className="py-1.5 text-ink-2">{SOURCE_SHORT_LABELS[s.source]}{s.saleCount > 1 ? ` ×${s.saleCount}` : ""}</td>
                <td className="tabular py-1.5 text-right font-semibold">{formatCents(s.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </li>
  );
}
