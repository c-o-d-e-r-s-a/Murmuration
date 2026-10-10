import assert from "node:assert/strict";
import { ROLES } from "./contracts";
import { NEUTRAL_PRESET_ID, PRESETS } from "./presets";
import { BUNDLED_SCENES, loadScene } from "./sceneLoader";
import rushHour from "./scenes/rush-hour.json";

const clone = () => structuredClone(rushHour) as any;

// rush-hour loads, 4 options per role, 8-10 prompts, labels <= 18
const s = loadScene(rushHour);
assert.equal(BUNDLED_SCENES[0].id, "rush-hour");
for (const r of ROLES) {
  assert.equal(s.options[r].length, 4);
  for (const o of s.options[r]) assert.ok(o.label.length <= 18, o.label);
}
assert.ok(s.prompts.length >= 8 && s.prompts.length <= 10);

// all three bundled scenes load with 4 options per role, short labels, 8-10 prompts, ranks 10/7/4/1
assert.deepEqual(BUNDLED_SCENES.map((b) => b.id), ["rush-hour", "diner", "vigilante"]);
for (const b of BUNDLED_SCENES) {
  for (const r of ROLES) {
    assert.deepEqual(b.options[r].map((o) => o.authorScore).sort((x, y) => y - x), [10, 7, 4, 1]);
    for (const o of b.options[r]) assert.ok(o.label.length <= 18, o.label);
  }
  assert.ok(b.prompts.length >= 8 && b.prompts.length <= 10, b.id);
}

// palette/form/motion use each non-neutral preset once; texture/mood stay neutral (solo plan)
for (const b of BUNDLED_SCENES) {
  for (const r of ["palette", "form", "motion"] as const) {
    const ids = b.options[r].map((o) => o.presetId);
    assert.equal(new Set(ids).size, 4, `${b.id} ${r}`);
    for (const id of ids) assert.equal(PRESETS[id].role, r);
  }
  for (const r of ["texture", "mood"] as const) for (const o of b.options[r]) assert.equal(o.presetId, NEUTRAL_PRESET_ID[r], o.id);
}

// D-40: brand names may appear only in `title`
for (const b of BUNDLED_SCENES) assert.doesNotMatch(JSON.stringify({ ...b, title: "" }), /waffle house|batman|gotham|bat-?signal/i, b.id);

// protected override keys are stripped, others kept
const a = clone();
a.options.motion[0].overrides = { motionRateHz: 30, motionArea: 1, motionAmplitude: 0.9 };
assert.deepEqual(loadScene(a).options.motion[0].overrides, { motionAmplitude: 0.9 });

// custom scenes lose overrides and hotspots
const c = clone();
c.kind = "custom";
c.options.motion[0].overrides = { motionAmplitude: 0.9 };
c.baseArt.shapes = [{ d: "M0 0", hotspot: "sign" }];
const cs = loadScene(c);
assert.equal(cs.options.motion[0].overrides, undefined);
assert.equal(cs.baseArt.shapes[0].hotspot, undefined);

// rejections
const bad = clone();
bad.options.form[0].presetId = "nope";
assert.throws(() => loadScene(bad), /presetId/);
const wrong = clone();
wrong.options.form[0].presetId = "pal-neon";
assert.throws(() => loadScene(wrong), /wrong-role/);
const three = clone();
three.options.palette.pop();
assert.throws(() => loadScene(three), /palette has 3/);
const dup = clone();
dup.options.mood[1].authorScore = 10;
assert.throws(() => loadScene(dup), /duplicate authorScore/);
const nodesc = clone();
delete nodesc.description;
assert.throws(() => loadScene(nodesc), /description/);
const long = clone();
long.prompts[0].text = "x".repeat(121);
assert.throws(() => loadScene(long), /prompt/);

console.log("sceneLoader self-check ok");
