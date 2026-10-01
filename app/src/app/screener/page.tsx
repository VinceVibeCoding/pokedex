import type { Metadata } from "next";
import Link from "next/link";
import { CardThumb } from "@/components/CardThumb";
import { TrackSetButton } from "@/components/TrackSetButton";
import { formatCents, formatPct } from "@/lib/format";
import { getScreener, SCREENER_PAGE_SIZE, type ScreenerRow, type ScreenerSort } from "@/serving/screener";
import { canonicalQuery, parseScreenerParams } from "@/serving/screenerParams";
import { SaveScreenButton } from "@/components/SaveScreenButton";
import type { Tag } from "@/analysis/trends";

export const metadata: Metadata = { title: "Screener" };
export const dynamic = "force-dynamic";

type Params = { q?: string; tag?: string; set?: string; rarity?: string; era?: string; min?: string; max?: string; sort?: string; page?: string };

const TAGS: Array<{ value: Tag; label: string }> = [
  { value: "trending", label: "Trending up" },
  { value: "undervalued", label: "Undervalued" },
  { value: "volume", label: "High volume" },
];
const SORTS: Array<{ value: ScreenerSort; label: string }> = [
  { value: "trend", label: "Biggest trend" },
  { value: "dip", label: "Deepest dip" },
  { value: "volume", label: "Most sales" },
  { value: "price", label: "Highest price" },
];
const TAG_STYLE: Record<Tag, string> = { trending: "var(--good)", undervalued: "var(--accent)", volume: "var(--warning)" };

export default async function ScreenerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const tag = TAGS.find((t) => t.value === sp.tag)?.value ?? null;
  const sort = SORTS.find((s) => s.value === sp.sort)?.value ?? "trend";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const res = await getScreener({ ...parseScreenerParams(sp), page });
  const saveQuery = canonicalQuery(sp);
  const pages = Math.max(1, Math.ceil(res.total / SCREENER_PAGE_SIZE));

  const current: Record<string, string | null> = { q: q || null, tag, sort: sort === "trend" ? null : sort, set: sp.set || null, rarity: sp.rarity || null, era: sp.era || null, min: sp.min || null, max: sp.max || null };
  const href = (over: Record<string, string | null> = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...over })) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/screener?${qs}` : "/screener";
  };
  const pill = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line text-ink-2 hover:text-ink"}`;
  const field = "h-10 rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          Cards that look undervalued, are trending up, or sell often — with the reason for every flag. These are leads to check against recent sales, not buy advice.
        </p>
      </div>

      {res.day === null ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
          The market snapshot hasn&apos;t been loaded yet. Run <code className="rounded bg-surface-2 px-1">npm run snapshot:prices</code> once (the daily job keeps it fresh after that).
        </p>
      ) : (
        <>
          <form action="/screener" className="flex flex-wrap items-center gap-2">
            {tag && <input type="hidden" name="tag" value={tag} />}
            {sort !== "trend" && <input type="hidden" name="sort" value={sort} />}
            <input type="search" name="q" defaultValue={q} placeholder="Search — e.g. charizard, jungle" aria-label="Search" className={`${field} min-w-[12rem] flex-1`} />
            <select name="era" defaultValue={sp.era ?? ""} aria-label="Era" className={`${field} max-w-[14rem]`}>
              <option value="">All eras</option>
              {res.facets.eras.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select name="set" defaultValue={sp.set ?? ""} aria-label="Set" className={`${field} max-w-[12rem]`}>
              <option value="">All sets</option>
              {res.facets.sets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="rarity" defaultValue={sp.rarity ?? ""} aria-label="Rarity" className={`${field} max-w-[11rem]`}>
              <option value="">All rarities</option>
              {res.facets.rarities.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="number" name="min" min={0} step="any" defaultValue={sp.min ?? ""} placeholder="Min $" aria-label="Minimum price" className={`${field} w-24`} />
            <input type="number" name="max" min={0} step="any" defaultValue={sp.max ?? ""} placeholder="Max $" aria-label="Maximum price" className={`${field} w-24`} />
            <button className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">Apply</button>
            <Link href="/screener" className="px-1 text-sm text-ink-2 hover:text-ink">Reset</Link>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ tag: null })} className={pill(tag === null)}>All</Link>
            {TAGS.map((t) => <Link key={t.value} href={href({ tag: t.value })} className={pill(tag === t.value)}>{t.label}</Link>)}
            <span className="mx-2 h-5 w-px bg-line" aria-hidden />
            {SORTS.map((s) => <Link key={s.value} href={href({ sort: s.value === "trend" ? null : s.value })} className={pill(sort === s.value)}>{s.label}</Link>)}
          </div>

          {res.coverage.withOwnHistory === 0 && res.coverage.withSales === 0 && res.coverage.withCardmarket === 0 && (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
              <strong className="text-ink">Trends are still building.</strong> We record every card&apos;s price daily; 7-day trends appear once a week of history exists and 30-day trends after a month. Until then the flags below stay empty (tracked cards with sold listings get flags sooner), and you can still browse and filter all {res.coverage.cards.toLocaleString()} priced cards. (The free Cardmarket feed we could use meanwhile is out of date, so we deliberately don&apos;t use it.)
            </p>
          )}
          <p className="text-sm text-ink-3">
            {res.total.toLocaleString()} cards · snapshot {res.day} · trends measured for {res.coverage.withSales.toLocaleString()} cards from real sold listings (cards we track) and {res.coverage.withOwnHistory.toLocaleString()} from our own daily price history (grows every day)
          </p>

          {sp.set && res.rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <span>Want sold-listing trends and volume for every card in {sp.set}?</span>
              <TrackSetButton setCode={res.rows[0].setCode} setName={sp.set} />
            </div>
          )}

          <SaveScreenButton query={saveQuery} />

          {res.rows.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">No cards match these filters.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
              {res.rows.map((r) => <Row key={r.cardId} r={r} />)}
            </ul>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? <Link href={href({ page: page - 1 > 1 ? String(page - 1) : null })} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">← Previous</Link> : <span />}
              {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">Next →</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Change({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="w-16 text-right">
      <div className="text-[11px] text-ink-3">{label}</div>
      {pct === null ? <div className="text-sm text-ink-3">—</div> : (
        <div className="tabular text-sm font-semibold" style={{ color: pct >= 0 ? "var(--good)" : "var(--critical)" }}>{pct >= 0 ? "▲" : "▼"} {formatPct(pct, 1).replace(/^[+-]/, "")}</div>
      )}
    </div>
  );
}

function Row({ r }: { r: ScreenerRow }) {
  return (
    <li>
      <Link href={`/card/${encodeURIComponent(r.cardId)}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-surface-2">
        <CardThumb src={r.imageUrl} alt="" width={40} />
        <div className="min-w-0 flex-1 basis-56">
          <div className="truncate font-medium">{r.name}{r.number ? <span className="text-ink-3"> #{r.number.split("/")[0]}</span> : null}</div>
          <div className="truncate text-xs text-ink-3">{r.setName} · {r.rarity}</div>
          {r.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.tags.map((t) => (
                <span key={t} className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: TAG_STYLE[t], color: TAG_STYLE[t] }}>
                  {TAGS.find((x) => x.value === t)?.label}
                </span>
              ))}
            </div>
          )}
          {r.reasons.length > 0 && <div className="mt-1 text-xs text-ink-2">{r.reasons.join(" · ")}</div>}
        </div>
        <div className="tabular w-20 text-right text-base font-semibold">{formatCents(r.priceCents)}</div>
        <Change label="7d" pct={r.change7dPct ?? r.cmMomentumPct} />
        <Change label="30d" pct={r.change30dPct} />
        <div className="w-16 text-right">
          <div className="text-[11px] text-ink-3">Sales/wk</div>
          <div className="tabular text-sm">{r.salesPerWeek === null ? "—" : r.salesPerWeek.toFixed(1)}</div>
        </div>
      </Link>
    </li>
  );
}
