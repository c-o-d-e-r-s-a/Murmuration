import assert from "node:assert/strict";
import type { Option, Scene } from "./contracts";
import { aiScore, audienceScore, authorScore, combined } from "./scoring";

const opts = (role: string): Option[] =>
  ([10, 7, 4, 1] as const).map((s, i) => ({ id: `${role}-${i}`, presetId: `${role}-p${i}`, label: `${role} ${i}`, authorScore: s }));
const scene = {
  options: { palette: opts("palette"), form: opts("form"), motion: opts("motion"), texture: opts("texture"), mood: opts("mood") },
} as unknown as Scene;
const pick = (optionId: string) => ({ optionId, uid: "u", at: 0 });

// author: mean over filled roles; unknown ids and empty choices ignored
assert.deepEqual(authorScore(scene, { palette: pick("palette-0"), form: pick("form-1"), motion: pick("motion-3") }), {
  score: 6,
  perRole: { palette: 10, form: 7, motion: 1 },
});
assert.deepEqual(authorScore(scene, { palette: pick("palette-2"), form: pick("nope") }), { score: 4, perRole: { palette: 4 } });
assert.equal(authorScore(scene, {}), null);
assert.equal(authorScore(scene, undefined), null);

// ai: clamp to integer 1..10, fallback 6
assert.deepEqual(aiScore(7), { score: 7, fallback: false });
assert.deepEqual(aiScore(14), { score: 10, fallback: false });
assert.deepEqual(aiScore(0), { score: 1, fallback: false });
assert.deepEqual(aiScore(6.6), { score: 7, fallback: false });
assert.deepEqual(aiScore("9"), { score: 6, fallback: true });
assert.deepEqual(aiScore(NaN), { score: 6, fallback: true });

// audience: none / median (<5) / trimmed mean (≥5, drop floor(10%) each end)
assert.deepEqual(audienceScore([]), { score: null, count: 0, method: "none" });
assert.deepEqual(audienceScore([4]), { score: 8, count: 1, method: "median" });
assert.deepEqual(audienceScore([1, 5, 4, 2]), { score: 6, count: 4, method: "median" });
assert.deepEqual(audienceScore([5, 1, 3, 4, 2]), { score: 6, count: 5, method: "trimmed" });
assert.deepEqual(audienceScore([1, 5, 5, 5, 5, 5, 5, 5, 5, 5]), { score: 10, count: 10, method: "trimmed" });

// combined: weighted mean of non-null parts
assert.equal(combined(6, 9, 6), 7);
assert.equal(combined(6, null, 9), 7.5);
assert.equal(combined(null, undefined, 8), 8);
assert.equal(combined(null, null, null), null);

console.log("scoring self-check: ok");
