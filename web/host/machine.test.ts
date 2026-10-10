import assert from "node:assert/strict";
import type { Round, Scene } from "../../shared/contracts";
import { botPlan, drawPrompt, due, ratingCap } from "./machine";

const r = (o: Partial<Round>): Round => ({ id: "r1", sceneId: "s", promptId: null, promptText: null, seed: 1, durationMs: 60000, status: "lobby", startsAt: null, lockedAt: null, ratingEndsAt: null, statusVersion: 1, ...o });

assert.equal(due(r({}), 1e9, false), null);
assert.equal(due(r({ status: "live", startsAt: 1000 }), 60999, false), null);
assert.equal(due(r({ status: "live", startsAt: 1000 }), 61000, false), "T3");
assert.equal(due(r({ status: "locked", lockedAt: 1000 }), 2499, false), null);
assert.equal(due(r({ status: "locked", lockedAt: 1000 }), 2500, false), "T4");
const rating = r({ status: "rating", lockedAt: 0, ratingEndsAt: 13500 });
assert.equal(due(rating, 13499, false), null);
assert.equal(due(rating, 13500, true), "T5");
assert.equal(due(rating, 13500, false), "extend");
assert.equal(ratingCap(rating), 26500);
assert.equal(due(r({ status: "rating", lockedAt: 0, ratingEndsAt: 26500 }), 26500, false), "T5");

const scene = { id: "s", prompts: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] } as Scene;
for (let i = 0; i < 20; i++) {
  const d = drawPrompt(scene, { "s:a": true }, "b");
  assert.deepEqual([d.prompt?.id, d.reset], ["c", false]);
}
const all = drawPrompt(scene, { "s:a": true, "s:b": true, "s:c": true }, "a");
assert.equal(all.reset, true);
assert.notEqual(all.prompt?.id, "a");
assert.equal(drawPrompt({ id: "s", prompts: [{ id: "a", text: "A" }] } as Scene, {}, "a").prompt, null);

for (let i = 0; i < 50; i++) {
  const p = botPlan(60000);
  assert.ok(p.length >= 2 && p.length <= 3);
  assert.ok(p[0] >= 4000 && p[0] <= 7000);
  assert.ok(p.every((t) => t <= 50000));
}
console.log("machine.test ok");
