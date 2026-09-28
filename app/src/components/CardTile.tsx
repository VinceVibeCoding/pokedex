import Link from "next/link";
import { CardThumb } from "./CardThumb";
import { formatCents, formatPct } from "@/lib/format";
import { GRADE_LABELS } from "@/lib/grade";
import type { GradeTier } from "@/types/domain";

/** Image-forward grid tile: card art on top, grade badge, price, optional change/meta line. */
export function CardTile({
  cardId,
  name,
  setName,
  imageUrl,
  gradeTier,
  priceCents,
  changePct,
  meta,
  badge,
}: {
  cardId: string;
  name: string;
  setName: string;
  imageUrl: string | null;
  gradeTier: GradeTier;
  priceCents: number;
  changePct?: number;
  meta?: string;
  badge?: string; // e.g. the sale's source
}) {
  return (
    <Link
      href={`/card/${encodeURIComponent(cardId)}?grade=${gradeTier}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-ink-3"
    >
      <div className="relative flex justify-center bg-surface-2 py-4">
        <CardThumb src={imageUrl} alt={name} width={112} />
        <span className="absolute left-2 top-2 rounded-md bg-bg/80 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
          {GRADE_LABELS[gradeTier]}
        </span>
        {badge && (
          <span className="absolute right-2 top-2 rounded-md border border-line bg-bg/80 px-1.5 py-0.5 text-[11px] text-ink-2 backdrop-blur">{badge}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <div className="truncate text-sm font-medium group-hover:underline">{name}</div>
        <div className="truncate text-xs text-ink-3">{setName}</div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="tabular text-base font-semibold">{formatCents(priceCents)}</span>
          {changePct !== undefined ? (
            <span className="tabular text-xs font-semibold" style={{ color: changePct >= 0 ? "var(--good)" : "var(--critical)" }}>
              {changePct >= 0 ? "▲" : "▼"} {formatPct(changePct, 1)}
            </span>
          ) : (
            meta && <span className="text-xs text-ink-3">{meta}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
