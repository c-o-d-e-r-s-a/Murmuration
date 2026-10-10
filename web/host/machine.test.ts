import assert from "node:assert/strict";
import type { Round, Scene } from "../../shared/contracts";
import { botPlan, drawPrompt, due, ratingCap, rotate } from "./machine";

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
// rotate: simulate New rounds, applying the returned writes like newRound() does
const ROLES3 = ["palette", "form", "motion"] as const;
const lobby = (n: number, bots = 0) => {
  const ps: Record<string, { queuePos: number; isBot?: boolean; removed?: boolean }> = {};
  for (let i = 1; i <= n; i++) ps[`p${i}`] = { queuePos: i };
  for (let i = 1; i <= bots; i++) ps[`bot_${i}`] = { queuePos: n + i, isBot: true };
  return ps;
};
const play = (orig: ReturnType<typeof lobby>, slots: Partial<Record<(typeof ROLES3)[number], string>>, rounds: number) => {
  const ps = structuredClone(orig);
  const seen = new Set<string>(Object.values(slots) as string[]);
  for (let i = 1; i < rounds; i++) {
    const x = rotate(ps, slots, ROLES3);
    for (const [uid, q] of Object.entries(x.queuePos)) ps[uid].queuePos = q;
    slots = x.slots;
    Object.values(slots).forEach((u) => seen.add(u!));
  }
  return { seen, slots };
};
const first3 = { palette: "p1", form: "p2", motion: "p3" };
assert.equal(play(lobby(6), first3, 2).seen.size, 6);
assert.equal(play(lobby(8), first3, 3).seen.size, 8);
assert.deepEqual(play(lobby(8), first3, 2).slots, { palette: "p4", form: "p5", motion: "p6" });
// late joiner (queuePos from serverTimestamp, far larger) waits behind everyone already queued
const late = lobby(6);
late.newbie = { queuePos: 1e12 };
assert.ok(!play(late, first3, 2).seen.has("newbie")); // p4..p6 were waiting first
assert.deepEqual(play(lobby(6), first3, 2).slots, play(late, first3, 2).slots);
assert.deepEqual(play(late, first3, 3).slots, { palette: "newbie", form: "p1", motion: "p2" }); // then newbie, ahead of the old Creators
// humans before bots; bots fill only the gap
const mixed = lobby(2, 3);
assert.deepEqual(rotate(mixed, { palette: "bot_1", form: "p1", motion: "p2" }, ROLES3).slots, { palette: "p1", form: "p2", motion: "bot_2" });
assert.deepEqual(rotate(lobby(3, 3), { palette: "bot_1", form: "bot_2", motion: "bot_3" }, ROLES3).slots, { palette: "p1", form: "p2", motion: "p3" });
// removed players are skipped
const rem = lobby(4);
rem.p1.removed = true;
assert.deepEqual(rotate(rem, {}, ROLES3).slots, { palette: "p2", form: "p3", motion: "p4" });
console.log("machine.test ok");
