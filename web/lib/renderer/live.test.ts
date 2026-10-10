import assert from "node:assert/strict";
import { FLICKER_MAX_AREA, FLICKER_MAX_HZ } from "../../../shared/contracts";
import { BUNDLED_SCENES } from "../../../shared/sceneLoader";
import { resolveTarget, toCurrent } from "./params";
import { createLive, REF_H, REF_W, STEP_MS, stepLive, stepsAt } from "./live";

const { options } = BUNDLED_SCENES[0];
const pick = (palette: string, form: string, motion: string) =>
  resolveTarget(options, {
    palette: { optionId: palette, uid: "u", at: 0 },
    form: { optionId: form, uid: "u", at: 0 },
    motion: { optionId: motion, uid: "u", at: 0 },
  });
// events by step: kind switches mid-crossfade included (steps 600 and 620)
const events: Record<number, ReturnType<typeof resolveTarget>> = {
  300: pick("pal-connector", "form-smog", "motion-brake"),
  600: pick("pal-sodium", "form-tailpipe", "motion-stutter"),
  620: pick("pal-sodium", "form-steam", "motion-weave"),
  1200: pick("pal-haze", "form-gravel", "motion-crawl"),
};

const run = (seed: number, untilMs: number) => {
  let target = resolveTarget(options, {});
  const cur = toCurrent(target);
  const L = createLive(seed, cur);
  while (L.steps < stepsAt(untilMs)) {
    target = events[L.steps] ?? target;
    stepLive(L, cur, target);
  }
  return { L, cur };
};

// same seed + same events -> identical state at t = 30 s (the sketch draws only from this state)
const a = run(7, 30000), b = run(7, 30000);
assert.equal(a.L.steps, 1800);
assert.deepEqual(a.L, b.L);
assert.deepEqual(a.cur, b.cur);

// different seed -> different particles
assert.notDeepEqual(run(8, 30000).L.x, a.L.x);

// particles stay within the wrap margin
const m = a.cur.particleSize * 1.5 + 1;
for (let i = 0; i < a.L.x.length; i++) {
  assert.ok(a.L.x[i] >= -m && a.L.x[i] <= REF_W + m && a.L.y[i] >= -m && a.L.y[i] <= REF_H + m);
}

// crossfade weights stay in 0..1 and converge to the current kind
assert.ok(a.L.pw.dust > 0.99 && a.L.mw.drift > 0.99);

// photosensitivity: a target that ignores the presets still can't exceed rate or area caps
const evil = { ...pick("pal-sodium", "form-smog", "motion-stutter"), motionRateHz: 30, motionArea: 1 };
const cur = toCurrent(evil);
const L = createLive(1, cur);
const before = L.phase;
stepLive(L, cur, evil);
assert.ok(L.phase - before <= 2 * Math.PI * FLICKER_MAX_HZ * (STEP_MS / 1000) + 1e-9);
assert.ok(L.gr <= Math.sqrt((FLICKER_MAX_AREA * REF_W * REF_H) / Math.PI) + 1e-9);

console.log("renderer live self-check ok");
