"use client";

// The lookup screen. Everything for every grade arrives in one response, so switching
// grade is instant (local state + URL update, no request). Layout is answer-first:
// fair price and max buy price at the top, supporting evidence below.

import { useEffect, useState } from "react";
import { CardSearch } from "./CardSearch";
import { CardThumb } from "./CardThumb";
import { PriceChart, type ChartPoint } from "./PriceChart";
import { PriceStatus } from "./PriceStatus";
import { formatAgo, formatCents, formatDate, formatPct } from "@/lib/format";
import { GRADE_LABELS, GRADE_TIERS, parseGradeInput } from "@/lib/grade";
import { pushRecent } from "@/lib/recent";
import type {
  BuyScore,
  CardLookupResponse,
  DailySale,
  GradeTier,
  MarketStabilityIndex,
  RecentSale,
  TierSnapshot,
} from "@/types/domain";

const SHORTCUT_KEYS: Record<string, GradeTier> = { r: "raw", "8": "psa8", "9": "psa9", "0": "psa10" };
const RECENT_SALES_SHOWN = 8;
/** Below this much daily history, say so — early numbers look more certain than they are. */
const SHORT_HISTORY_DAYS = 14;

export function CardView({ lookup }: { lookup: CardLookupResponse }) {
  const { card, tiers, gradePremium, computedAt, dataFreshnessAt, tracking } = lookup;
  const [tier, setTier] = useState<GradeTier>(lookup.selectedTier);
  const [gradeNote, setGradeNote] = useState<string | null>(null);
  const [roiPct, setRoiPct] = useState(20);
  const asOf = new Date(computedAt);

  const selected = tiers.find((t) => t.gradeTier === tier)!;
  const rawMarket = tiers.find((t) => t.gradeTier === "raw")?.priceGuide?.marketPriceCents ?? null;

  function selectTier(next: GradeTier, note: string | null = null) {
    setTier(next);
    setGradeNote(note);
    window.history.replaceState(null, "", `?grade=${next}`);
  }

  useEffect(() => {
    pushRecent({ id: card.id, name: card.name, setName: card.setName, number: card.number, imageUrl: card.imageUrl });
  }, [card.id, card.name, card.setName, card.number, card.imageUrl]);

  // R / 8 / 9 / 0 switch grade from anywhere except text inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      const next = SHORTCUT_KEYS[e.key.toLowerCase()];
      if (next) {
        setTier(next);
        setGradeNote(null);
        window.history.replaceState(null, "", `?grade=${next}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <CardSearch size="md" grade={tier} />

      <section className="flex gap-4 sm:gap-5">
        <CardThumb src={card.imageUrl} alt={card.name} width={112} eager />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{card.name}</h1>
          <p className="mt-1 text-ink-2">
            {card.setName}
            {card.number ? ` · #${card.number}` : ""} · {card.releaseDate.slice(0, 4)}
          </p>
          <p className="mt-0.5 text-sm text-ink-3">
            {[card.rarity, card.printVariant, card.artist && `Illus. ${card.artist}`].filter(Boolean).join(" · ")}
            {card.pullRate ? ` · ~1 in ${Math.round(1 / card.pullRate)} packs` : ""}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            {dataFreshnessAt ? `Prices updated ${formatAgo(dataFreshnessAt, asOf)}` : "No price data collected yet"}
          </p>
        </div>
      </section>

      <PriceStatus cardId={card.id} tracking={tracking} />

      <GradePicker
        tiers={tiers}
        selected={tier}
        rawMarket={rawMarket}
        onSelect={selectTier}
        note={gradeNote}
        onNote={setGradeNote}
      />
      {gradePremium && (
        <GradingHint tiers={tiers} gradingCostCents={gradePremium.gradingCostCents} />
      )}

      {selected.priceGuide && selected.signals ? (
        <TierDetails tier={selected} roiPct={roiPct} onRoi={setRoiPct} asOf={asOf} />
      ) : (
        <InsufficientData tier={tier} tiers={tiers} onSelect={selectTier} />
      )}
    </div>
  );
}

function GradePicker({
  tiers,
  selected,
  rawMarket,
  onSelect,
  note,
  onNote,
}: {
  tiers: TierSnapshot[];
  selected: GradeTier;
  rawMarket: number | null;
  onSelect: (tier: GradeTier, note?: string | null) => void;
  note: string | null;
  onNote: (note: string | null) => void;
}) {
  const [other, setOther] = useState("");

  return (
    <section aria-label="Grade">
      <div role="radiogroup" aria-label="Grade" className="grid grid-cols-4 gap-2">
        {GRADE_TIERS.map((gradeTier) => {
          const t = tiers.find((x) => x.gradeTier === gradeTier)!;
          const market = t.priceGuide?.marketPriceCents ?? null;
          const multiple = market !== null && rawMarket && gradeTier !== "raw" ? market / rawMarket : null;
          const isSelected = gradeTier === selected;
          return (
            <button
              key={gradeTier}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(gradeTier)}
              title={`Shortcut: ${gradeTier === "raw" ? "R" : gradeTier === "psa10" ? "0" : gradeTier.slice(-1)}`}
              className={`rounded-xl border px-2 py-2.5 text-left transition-colors sm:px-3 ${
                isSelected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <div className={`text-xs font-medium ${isSelected ? "opacity-90" : "text-ink-2"}`}>
                {GRADE_LABELS[gradeTier]}
              </div>
              <div className="tabular mt-0.5 text-base font-semibold sm:text-lg">
                {market !== null ? formatCents(market) : "—"}
              </div>
              <div className={`tabular text-xs ${isSelected ? "opacity-90" : "text-ink-3"}`}>
                {market === null ? "No recent sales" : multiple ? `${multiple.toFixed(1)}× raw` : `${t.priceGuide!.sampleSize} sale${t.priceGuide!.sampleSize === 1 ? "" : "s"}`}
              </div>
            </button>
          );
        })}
      </div>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseGradeInput(other);
          if (parsed.ok) {
            onSelect(parsed.tier, parsed.note);
            setOther("");
          } else {
            onNote(parsed.note);
          }
        }}
      >
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Other grade, e.g. CGC 9.5"
          aria-label="Type a grade"
          className="h-8 w-52 rounded-lg border border-line bg-surface px-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
        />
        {note && <p className="text-sm text-ink-2">{note}</p>}
      </form>
    </section>
  );
}

/** One plain-language line about raw vs graded — only when both ends have data. */
function GradingHint({ tiers, gradingCostCents }: { tiers: TierSnapshot[]; gradingCostCents: number }) {
  const raw = tiers.find((t) => t.gradeTier === "raw")?.priceGuide?.marketPriceCents;
  const psa10 = tiers.find((t) => t.gradeTier === "psa10")?.priceGuide?.marketPriceCents;
  if (!raw || !psa10) return null;
  const upside = psa10 - raw - gradingCostCents;
  return (
    <p className="-mt-2 text-sm text-ink-2">
      Buy raw + grade (~{formatCents(gradingCostCents)}): a PSA 10 result is worth{" "}
      <span className="tabular font-medium text-ink">{formatCents(Math.max(upside, 0))}</span> more than you paid — but
      most raw copies won&apos;t grade 10.
    </p>
  );
}

function TierDetails({
  tier,
  roiPct,
  onRoi,
  asOf,
}: {
  tier: TierSnapshot;
  roiPct: number;
  onRoi: (pct: number) => void;
  asOf: Date;
}) {
  const guide = tier.priceGuide!;
  const signals = tier.signals!;
  const [showAllSales, setShowAllSales] = useState(false);
  const maxBuy = guide.maxBuyPrices.find((m) => m.targetRoiPct === roiPct) ?? guide.maxBuyPrices[0];
  const daily = tier.basis?.kind === "daily";
  const rowCount = daily ? tier.dailySales.length : tier.recentSales.length;
  const shown = showAllSales ? rowCount : RECENT_SALES_SHOWN;
  const oldestDay = daily && tier.dailySales.length > 0 ? tier.dailySales[tier.dailySales.length - 1].date : null;
  const historyDays = oldestDay
    ? Math.floor((asOf.getTime() - Date.parse(`${oldestDay}T00:00:00Z`)) / 86_400_000) + 1
    : null;
  const chartPoints: ChartPoint[] = daily
    ? tier.dailySales.map((d) => ({ at: `${d.date}T12:00:00.000Z`, priceCents: d.avgPriceCents, count: d.saleCount }))
    : tier.recentSales.map((s) => ({ at: s.soldAt, priceCents: s.priceCents, count: 1 }));

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-sm text-ink-2">Fair price · {GRADE_LABELS[tier.gradeTier]}</div>
          <div className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatCents(guide.marketPriceCents)}</div>
          <div className="tabular mt-1 text-sm text-ink-2">
            Typical {formatCents(guide.typicalLowCents)}–{formatCents(guide.typicalHighCents)}
          </div>
          <div className="mt-0.5 text-xs text-ink-3">
            Median of {guide.sampleSize} sale{guide.sampleSize === 1 ? "" : "s"}, last {guide.basis === "30d" ? "30" : "90"} days
            {guide.sampleSize < 3 ? " — thin data, treat as rough" : ""}
          </div>
          {tier.basis && <div className="mt-0.5 text-xs text-ink-3">{tier.basis.label}</div>}
          {historyDays !== null && historyDays < SHORT_HISTORY_DAYS && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-2">
              <span aria-hidden style={{ color: "var(--warning)" }}>●</span>
              Only {historyDays} day{historyDays === 1 ? "" : "s"} of history so far — it builds up daily, so treat trend
              and stability as early.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-sm text-ink-2">To flip, pay up to</div>
          <div className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatCents(maxBuy.priceCents)}</div>
          <div role="radiogroup" aria-label="Target profit" className="mt-2 flex flex-wrap gap-1.5">
            {guide.maxBuyPrices.map((m) => (
              <button
                key={m.targetRoiPct}
                role="radio"
                aria-checked={m.targetRoiPct === maxBuy.targetRoiPct}
                onClick={() => onRoi(m.targetRoiPct)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  m.targetRoiPct === maxBuy.targetRoiPct
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                {m.targetRoiPct === 0 ? "Break-even" : `+${m.targetRoiPct}%`}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-ink-3">
            After eBay fees (13.25% + $0.40) and shipping · you net {formatCents(guide.netAfterFeesCents)} at market
          </div>
        </div>

        {tier.buyScore && <Verdict score={tier.buyScore} />}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={daily ? "Last sale day" : "Last sale"}
          value={signals.lastSalePriceCents !== null ? formatCents(signals.lastSalePriceCents) : "—"}
          sub={signals.lastSaleAt ? formatAgo(signals.lastSaleAt, asOf) : undefined}
        />
        <Stat label="Sales / week" value={String(signals.salesPerWeek)} sub={`${signals.salesPerMonth} in 30 days`} />
        <Stat
          label="30-day trend"
          value={signals.priceTrendPct !== null ? formatPct(signals.priceTrendPct, 1) : "—"}
          sub={signals.priceTrendPct !== null ? "vs prior 30 days" : "Not enough history"}
        />
        {tier.stability && <StabilityStat stability={tier.stability} />}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-ink-2">
          {GRADE_LABELS[tier.gradeTier]} sales · last 90 days
        </h2>
        <PriceChart sales={chartPoints} marketCents={guide.marketPriceCents} asOf={asOf.toISOString()} />
        {daily && <p className="mt-1 text-xs text-ink-3">Each dot is one day&apos;s average — hover for the number of sales.</p>}
      </section>

      {tier.buyScore && (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Why this verdict?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {tier.buyScore.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-ink-2">{daily ? "Daily sales" : "Recent sales"}</h2>
        {daily ? (
          <DailySalesTable days={tier.dailySales.slice(0, shown)} />
        ) : (
          <RecentSalesTable sales={tier.recentSales.slice(0, shown)} />
        )}
        {rowCount > RECENT_SALES_SHOWN && (
          <button onClick={() => setShowAllSales((v) => !v)} className="mt-2 text-sm text-accent hover:underline">
            {showAllSales ? "Show fewer" : `Show all ${rowCount}`}
          </button>
        )}
      </section>
    </>
  );
}

const SOURCE_LABELS = { tcgplayer: "TCGplayer", collectr: "Collectr", one30point: "eBay" } as const;

function RecentSalesTable({ sales }: { sales: RecentSale[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sr-only">
        <tr>
          <th>Date</th>
          <th>Price</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {sales.map((s, i) => (
          <tr key={`${s.soldAt}-${i}`} className="border-t border-line first:border-t-0">
            <td className="w-full py-1.5 text-ink-2">{formatDate(s.soldAt)}</td>
            <td className="tabular whitespace-nowrap py-1.5 text-right font-medium">{formatCents(s.priceCents)}</td>
            <td className="whitespace-nowrap py-1.5 pl-6 text-right text-ink-3">
              {s.sourceUrl ? (
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {SOURCE_LABELS[s.source]} ↗
                </a>
              ) : (
                SOURCE_LABELS[s.source]
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DailySalesTable({ days }: { days: DailySale[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-ink-3">
          <th className="pb-1 text-left font-normal">Day</th>
          <th className="whitespace-nowrap pb-1 text-right font-normal">Avg price</th>
          <th className="pb-1 pl-6 text-right font-normal">Sales</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className="border-t border-line">
            <td className="w-full py-1.5 text-ink-2">{formatDate(`${d.date}T12:00:00.000Z`)}</td>
            <td className="tabular whitespace-nowrap py-1.5 text-right font-medium">{formatCents(d.avgPriceCents)}</td>
            <td className="tabular whitespace-nowrap py-1.5 pl-6 text-right text-ink-3">{d.saleCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const VERDICTS: Record<BuyScore["verdict"], { label: string; icon: string; color: string }> = {
  strong_buy: { label: "Strong buy", icon: "▲▲", color: "var(--good)" },
  buy: { label: "Buy", icon: "▲", color: "var(--good)" },
  hold: { label: "Hold", icon: "●", color: "var(--warning)" },
  avoid: { label: "Avoid", icon: "▼", color: "var(--critical)" },
};

function Verdict({ score }: { score: BuyScore }) {
  const v = VERDICTS[score.verdict];
  return (
    <div
      className="flex flex-row items-center gap-3 rounded-2xl border p-4 sm:min-w-36 sm:flex-col sm:items-start sm:justify-center"
      style={{ borderColor: v.color, background: `color-mix(in oklab, ${v.color} 10%, var(--surface))` }}
    >
      <div className="text-sm text-ink-2">Verdict</div>
      <div className="flex items-center gap-2 text-2xl font-semibold">
        <span aria-hidden style={{ color: v.color }} className="text-lg">
          {v.icon}
        </span>
        {v.label}
      </div>
      <div className="tabular text-xs text-ink-3">Score {score.score}/100</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="tabular mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

function StabilityStat({ stability }: { stability: MarketStabilityIndex }) {
  const level =
    stability.score >= 70
      ? { label: "Stable", color: "var(--good)" }
      : stability.score >= 40
        ? { label: "Moderate", color: "var(--warning)" }
        : { label: "Unstable", color: "var(--critical)" };
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-xs text-ink-2">Market stability</div>
      <div className="mt-0.5 text-lg font-semibold">{level.label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${stability.score}%`, background: level.color }} />
        </div>
        <span className="tabular text-xs text-ink-3">{Math.round(stability.score)}</span>
      </div>
    </div>
  );
}

function InsufficientData({
  tier,
  tiers,
  onSelect,
}: {
  tier: GradeTier;
  tiers: TierSnapshot[];
  onSelect: (tier: GradeTier) => void;
}) {
  const withData = tiers.filter((t) => t.priceGuide !== null);
  return (
    <section className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
      <p className="font-medium">No {GRADE_LABELS[tier]} sales in the last 90 days.</p>
      <p className="mt-1 text-sm text-ink-2">
        {withData.length > 0
          ? "Not enough data to price this grade. These grades have recent sales:"
          : "We don't have recent sales for any grade of this card yet."}
      </p>
      {withData.length > 0 && (
        <div className="mt-3 flex justify-center gap-2">
          {withData.map((t) => (
            <button
              key={t.gradeTier}
              onClick={() => onSelect(t.gradeTier)}
              className="rounded-full border border-line px-3 py-1 text-sm hover:bg-surface-2"
            >
              {GRADE_LABELS[t.gradeTier]} · {formatCents(t.priceGuide!.marketPriceCents)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
