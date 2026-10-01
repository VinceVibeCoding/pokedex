// Daily email digest of saved screens: for every screen with email alerts on, find cards that
// matched since the last digest (a screen's "watch list" = its top DIGEST_TOP matches) and send ONE
// email per user. Nothing is sent when nothing is new. Needs RESEND_API_KEY (+ a verified
// DIGEST_FROM sender); without a key the job reports "skipped" and changes nothing, so no
// matches are lost.

import { clerkClient } from "@clerk/nextjs/server";
import { getPrisma } from "../lib/prisma";
import { formatCents, formatPct } from "../lib/format";
import { getScreener } from "../serving/screener";
import { paramsFromQuery, parseScreenerParams } from "../serving/screenerParams";

export const DIGEST_TOP = 200;
const MAX_CARDS_PER_SCREEN = 8;

export interface DigestCard {
  cardId: string;
  name: string;
  setName: string;
  priceCents: number;
  trendPct: number | null;
  reason: string | null;
}
export interface DigestScreen {
  name: string;
  query: string;
  newCards: DigestCard[]; // already trimmed for display
  totalNew: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function formatDigest(screens: DigestScreen[], siteUrl: string): { subject: string; html: string; text: string } {
  const total = screens.reduce((a, s) => a + s.totalNew, 0);
  const subject = total === 1 ? "1 new card matches your saved screens" : `${total} new cards match your saved screens`;
  const line = (c: DigestCard) =>
    `${c.name} (${c.setName}) — ${formatCents(c.priceCents)}${c.trendPct !== null ? ` ${formatPct(c.trendPct, 1)}` : ""}${c.reason ? ` — ${c.reason}` : ""}`;

  const text = [
    ...screens.flatMap((s) => [
      `${s.name} — ${s.totalNew} new`,
      ...s.newCards.map((c) => `  • ${line(c)}  ${siteUrl}/card/${encodeURIComponent(c.cardId)}`),
      s.totalNew > s.newCards.length ? `  …and ${s.totalNew - s.newCards.length} more: ${siteUrl}/screener?${s.query}` : "",
      "",
    ]),
    "These are leads to check against recent sales, not buy advice.",
    `Manage alerts: ${siteUrl}/screens`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
${screens
  .map(
    (s) => `<h3 style="margin:16px 0 4px">${esc(s.name)} <span style="font-weight:400;color:#666">· ${s.totalNew} new</span></h3>
<ul style="padding-left:18px;margin:0">${s.newCards
      .map((c) => `<li><a href="${esc(siteUrl)}/card/${encodeURIComponent(c.cardId)}">${esc(c.name)}</a> (${esc(c.setName)}) — ${esc(formatCents(c.priceCents))}${c.trendPct !== null ? ` ${esc(formatPct(c.trendPct, 1))}` : ""}${c.reason ? `<br><span style="color:#666;font-size:13px">${esc(c.reason)}</span>` : ""}</li>`)
      .join("")}</ul>${s.totalNew > s.newCards.length ? `<p style="margin:4px 0"><a href="${esc(siteUrl)}/screener?${esc(s.query)}">…and ${s.totalNew - s.newCards.length} more</a></p>` : ""}`,
  )
  .join("\n")}
<p style="color:#666;font-size:13px;margin-top:20px">These are leads to check against recent sales, not buy advice. <a href="${esc(siteUrl)}/screens">Manage alerts</a></p>
</div>`;
  return { subject, html, text };
}

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

async function emailOf(userId: string): Promise<string | null> {
  const user = await (await clerkClient()).users.getUser(userId);
  return user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
}

async function send(to: string, mail: { subject: string; html: string; text: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.DIGEST_FROM ?? "Card Index <onboarding@resend.dev>", to, ...mail }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

export async function runDigests(): Promise<{ users: number; emails: number; skipped?: string }> {
  if (!process.env.RESEND_API_KEY) return { users: 0, emails: 0, skipped: "RESEND_API_KEY not set" };
  const prisma = getPrisma();
  const screens = await prisma.savedScreen.findMany({ where: { notifyEmail: true }, orderBy: { createdAt: "asc" } });
  const byUser = new Map<string, typeof screens>();
  for (const s of screens) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  let emails = 0;
  for (const [userId, list] of byUser) {
    try {
      const digest: DigestScreen[] = [];
      const matchIds = new Map<string, string[]>(); // screen id → its current top matches
      for (const s of list) {
        const res = await getScreener({ ...parseScreenerParams(paramsFromQuery(s.query)), pageSize: DIGEST_TOP });
        matchIds.set(s.id, res.rows.map((r) => r.cardId));
        const seen = new Set(s.lastMatchIds);
        const fresh = res.rows.filter((r) => !seen.has(r.cardId));
        if (fresh.length > 0) {
          digest.push({
            name: s.name,
            query: s.query,
            totalNew: fresh.length,
            newCards: fresh.slice(0, MAX_CARDS_PER_SCREEN).map((r) => ({
              cardId: r.cardId, name: r.name, setName: r.setName, priceCents: r.priceCents, trendPct: r.trendPct, reason: r.reasons[0] ?? null,
            })),
          });
        }
      }
      if (digest.length > 0) {
        const to = await emailOf(userId);
        if (!to) continue; // no email on file: leave lastMatchIds alone so nothing is lost
        await send(to, formatDigest(digest, siteUrl()));
        emails++;
      }
      // Only after a successful send (or nothing to send): record what has now been reported.
      for (const s of list) {
        await prisma.savedScreen.update({
          where: { id: s.id },
          data: { lastMatchIds: matchIds.get(s.id) ?? [], ...(digest.some((d) => d.query === s.query && d.name === s.name) ? { lastEmailedAt: new Date() } : {}) },
        });
      }
    } catch (err) {
      console.error(`[digest] user ${userId}: ${(err as Error).message}`); // one user's failure never blocks the rest
    }
  }
  return { users: byUser.size, emails };
}
