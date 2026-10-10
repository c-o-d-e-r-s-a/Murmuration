// Score formulas from docs/CONTRACTS.md §4. Pure functions; self-check in scoring.test.ts.
import { ROLES, SCORE_WEIGHTS } from "./contracts";
import type { AudienceResult, AuthorResult, Choices, Role, Scene } from "./contracts";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Mean of the chosen options' author ranks (10/7/4/1). Unknown option ids don't count.
export function authorScore(scene: Scene, choices: Choices | null | undefined): AuthorResult | null {
  const perRole: Partial<Record<Role, number>> = {};
  for (const role of ROLES) {
    const id = choices?.[role]?.optionId;
    const option = id ? scene.options[role]?.find((o) => o.id === id) : undefined;
    if (option) perRole[role] = option.authorScore;
  }
  const scores = Object.values(perRole) as number[];
  return scores.length ? { score: mean(scores), perRole } : null;
}

// Gemini's integer 1..10, clamped; anything unusable becomes the fallback 6.
export function aiScore(raw: unknown): { score: number; fallback: boolean } {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { score: 6, fallback: true };
  return { score: Math.min(10, Math.max(1, Math.round(raw))), fallback: false };
}

// Ratings are 1..5; displayed ×2 on the 0..10 scale.
export function audienceScore(ratings: number[]): AudienceResult {
  const n = ratings.length;
  if (n === 0) return { score: null, count: 0, method: "none" };
  if (n < 5) return { score: 2 * median(ratings), count: n, method: "median" };
  const drop = Math.floor(0.1 * n);
  const kept = [...ratings].sort((a, b) => a - b).slice(drop, n - drop);
  return { score: 2 * mean(kept), count: n, method: "trimmed" };
}

// Weighted mean of whichever scores exist.
export function combined(
  author: number | null | undefined,
  ai: number | null | undefined,
  audience: number | null | undefined,
): number | null {
  const parts: [number | null | undefined, number][] = [
    [author, SCORE_WEIGHTS.author],
    [ai, SCORE_WEIGHTS.ai],
    [audience, SCORE_WEIGHTS.audience],
  ];
  let sum = 0;
  let weight = 0;
  for (const [score, w] of parts) {
    if (score == null) continue;
    sum += score * w;
    weight += w;
  }
  return weight ? sum / weight : null;
}
