// Grade detection — maps free-text listing conditions to a GradeTier.
// Ingestion normalizes every listing through this before persisting,
// so raw and graded comps never mix (see CLAUDE.md).

import type { GradeTier } from "../types/domain";

const PSA_PATTERNS: Array<{ tier: GradeTier; pattern: RegExp }> = [
  { tier: "psa10", pattern: /\bpsa\s*10\b|\bgem\s*mint\s*10\b|\bgm\s*10\b/i },
  { tier: "psa9", pattern: /\bpsa\s*9\b|\bmint\s*9\b/i },
  { tier: "psa8", pattern: /\bpsa\s*8\b|\bnm[- ]?mt\s*8\b/i },
];

/**
 * Detects the grade tier from listing text.
 * Explicit PSA mentions win; otherwise the listing is treated as raw
 * (ungraded condition text like "NM"/"LP" stays on the comp as `condition`).
 * Returns null only when there is no text to classify at all.
 */
export function detectGradeTier(conditionText: string | null): GradeTier | null {
  if (!conditionText) return null;
  for (const { tier, pattern } of PSA_PATTERNS) {
    if (pattern.test(conditionText)) return tier;
  }
  return "raw";
}

/**
 * Splits a raw listing's condition text into (gradeTier, condition).
 * For graded comps, condition is cleared — grade IS the condition.
 */
export function normalizeCondition(
  conditionText: string | null,
): { gradeTier: GradeTier; condition: string | null } {
  const tier = detectGradeTier(conditionText);
  if (tier === null) return { gradeTier: "raw", condition: null };
  if (tier === "raw") return { gradeTier: "raw", condition: conditionText };
  return { gradeTier: tier, condition: null };
}
