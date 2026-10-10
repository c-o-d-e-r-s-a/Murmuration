import assert from "node:assert/strict";
import { FLICKER_MAX_AREA, FLICKER_MAX_HZ, ROLES } from "./contracts";
import { NEUTRAL_PRESET_ID, PRESETS, getPreset, presetParams, stripProtected } from "./presets";

// every role has a neutral; palette/form/motion have 4 non-neutral presets
for (const r of ROLES) assert.equal(PRESETS[NEUTRAL_PRESET_ID[r]].role, r);
for (const r of ["palette", "form", "motion"]) {
  assert.equal(Object.values(PRESETS).filter((x) => x.role === r && x.id !== NEUTRAL_PRESET_ID[r as keyof typeof NEUTRAL_PRESET_ID]).length, 4);
}

// every preset respects the photosensitivity caps
for (const x of Object.values(PRESETS)) {
  assert.ok((x.params.motionRateHz ?? 0) <= FLICKER_MAX_HZ, x.id);
  assert.ok((x.params.motionArea ?? 0) <= FLICKER_MAX_AREA, x.id);
}

// unknown or wrong-role id falls back to neutral
assert.equal(getPreset("palette", "nope").id, "pal-neutral");
assert.equal(getPreset("palette", "form-fog").id, "pal-neutral");

// overrides cannot set protected keys, but other keys pass
assert.deepEqual(stripProtected({ motionRateHz: 30, motionArea: 1, washOpacity: 0.9 }), { washOpacity: 0.9 });
const o = presetParams("motion", "motion-flicker", { motionRateHz: 30, motionArea: 1, motionAmplitude: 0.9 });
assert.equal(o.motionRateHz, 2.5);
assert.equal(o.motionArea, 0.15);
assert.equal(o.motionAmplitude, 0.9);

console.log("presets self-check ok");
