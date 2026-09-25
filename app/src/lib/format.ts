// Display formatting shared by every UI surface.

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD_ROUND = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** $1,234 for amounts ≥ $100 or whole dollars, $12.50 otherwise — cents only where they matter. */
export function formatCents(cents: number): string {
  return cents >= 10000 || cents % 100 === 0 ? USD_ROUND.format(cents / 100) : USD.format(cents / 100);
}

export function formatPct(pct: number, digits = 0): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

/** "today", "3d ago", "5w ago", "4mo ago", "2y ago". */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 730) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
