import assert from "node:assert/strict";
import { EASE_NUMERIC_MS } from "../../../shared/contracts";
import type { Scene } from "../../../shared/contracts";
import { PRESETS } from "../../../shared/presets";
import { ease, resolveTarget, toCurrent } from "./params";

const options = {
  palette: [{ id: "a", presetId: "pal-neon", label: "A", authorScore: 10 }],
  motion: [{ id: "m", presetId: "motion-flicker", label: "M", authorScore: 10, overrides: { motionRateHz: 30, motionAmplitude: 0.9 } }],
} as unknown as Scene["options"];

// no choices: every role neutral, and every RenderParams key is filled
const neutral = resolveTarget(options, {});
assert.deepEqual(neutral.colors, PRESETS["pal-neutral"].params.colors);
assert.equal(neutral.motionKind, "still");
assert.equal(Object.keys(neutral).length, 16);

// chosen option resolves through its preset; overrides apply but protected keys are stripped
const t = resolveTarget(options, {
  palette: { optionId: "a", uid: "u", at: 0 },
  motion: { optionId: "m", uid: "u", at: 0 },
  form: { optionId: "missing", uid: "u", at: 0 },
});
assert.equal(t.colors[1], "#2fd0c8");
assert.equal(t.motionRateHz, 2.5);
assert.equal(t.motionAmplitude, 0.9);
assert.equal(t.particleKind, "dust"); // unknown option id -> neutral form

// easing: one time constant covers ~63%, never overshoots, and converges; no pop on a jump
const cur = toCurrent(neutral);
ease(cur, t, EASE_NUMERIC_MS);
const frac = (cur.washOpacity - neutral.washOpacity) / (t.washOpacity - neutral.washOpacity);
assert.ok(Math.abs(frac - (1 - Math.exp(-1))) < 1e-9, String(frac));
assert.equal(cur.motionKind, t.motionKind);
for (let i = 0; i < 600; i++) ease(cur, t, 16);
assert.ok(Math.abs(cur.washOpacity - t.washOpacity) < 1e-6);
assert.ok(Math.abs(cur.colors[1][0] - 0x2f) < 0.01);

// frame-rate independent: 1 x 32 ms == 2 x 16 ms
const a = toCurrent(neutral), b = toCurrent(neutral);
ease(a, t, 32);
ease(b, t, 16);
ease(b, t, 16);
assert.ok(Math.abs(a.washOpacity - b.washOpacity) < 1e-12);

console.log("renderer params self-check ok");
