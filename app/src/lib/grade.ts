// Grade parsing for the UI's free-form grade box ("psa 9", "10", "cgc 9.5", "raw").
// Pure and dependency-free so the web page, Chrome extension and iPhone app can share it.

import type { GradeTier } from "../types/domain";

export const GRADE_TIERS: GradeTier[] = ["raw", "psa8", "psa9", "psa10"];

export const GRADE_LABELS: Record<GradeTier, string> = {
  raw: "Raw",
  psa8: "PSA 8",
  psa9: "PSA 9",
  psa10: "PSA 10",
};

export function isGradeTier(value: unknown): value is GradeTier {
  return typeof value === "string" && (GRADE_TIERS as string[]).includes(value);
}

export type ParsedGrade =
  | { ok: true; tier: GradeTier; note: string | null }
  | { ok: false; note: string };

const RAW_WORDS = /^(raw|ungraded|nm|near mint|lp|mp|hp|dmg)$/;
const GRADED = /^(psa|bgs|beckett|cgc|sgc|tag|ace)?\s*(?:gem\s*mint|mint|nm-?mt)?\s*(\d+(?:\.\d+)?)$/;

/**
 * Maps free text to the nearest tier we track. Non-PSA graders map to the PSA tier
 * with the same number, with a note — their prices differ, so the UI must say so.
 * Half grades round down (a 9.5 is shown as a 9), except anything ≥ 10.
 */
export function parseGradeInput(text: string): ParsedGrade {
  const input = text.trim().toLowerCase();
  if (input === "" || RAW_WORDS.test(input)) return { ok: true, tier: "raw", note: null };

  const match = GRADED.exec(input);
  if (!match) return { ok: false, note: `Couldn't read "${text}". Try "PSA 9", "10" or "raw".` };

  const grader = (match[1] ?? "psa").replace("beckett", "bgs");
  const value = Number(match[2]);
  const tier: GradeTier | null =
    value >= 10 ? "psa10" : value >= 9 ? "psa9" : value >= 8 ? "psa8" : null;

  if (tier === null) {
    return { ok: false, note: `Grade ${match[2]} isn't tracked yet — only PSA 8, 9, 10 and raw.` };
  }

  const notes: string[] = [];
  if (grader !== "psa") notes.push(`${grader.toUpperCase()} shown as ${GRADE_LABELS[tier]} — prices differ by grader.`);
  if (!Number.isInteger(value) && value < 10) notes.push(`${match[2]} rounded down to ${Math.floor(value)}.`);
  return { ok: true, tier, note: notes.length > 0 ? notes.join(" ") : null };
}
