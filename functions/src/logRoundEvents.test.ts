// Self-check for the Tiger mirror: live insert, idempotent re-run, bogus URL fails fast, cleanup.
// npx tsx --env-file=functions/.secret.local functions/src/logRoundEvents.test.ts   (omit --env-file for offline only)
import assert from "node:assert/strict";
import type {ChoiceEvent, Round} from "../../shared/contracts";
import {makePool, tigerPool} from "./lib/tiger";
import {mirrorRound, uidHash} from "./logRoundEvents";

assert.equal(uidHash("bot_1"), uidHash("bot_1"));
assert.match(uidHash("bot_1"), /^[0-9a-f]{8}$/);
assert.notEqual(uidHash("bot_1"), uidHash("bot_2"));

// "SELFTEST" can never be a real 4-char session code, so cleanup cannot touch real rows.
const CODE = "SELFTEST";
const startsAt = Date.UTC(2026, 9, 10, 16, 0, 0);
const round: Round = {
  id: "r1", sceneId: "rush-hour", promptId: "p1", promptText: "x", seed: 1, durationMs: 90000, status: "reveal",
  startsAt, lockedAt: startsAt + 90000, ratingEndsAt: null, slots: {palette: "bot_1", form: "bot_2", motion: "bot_3"}, statusVersion: 5,
};
const events: Record<string, ChoiceEvent> = {
  a: {t: 1200, role: "palette", optionId: "peach", uid: "bot_1"},
  b: {t: 3400, role: "form", optionId: "fog", uid: "bot_2"},
  c: {t: 5100, role: "motion", optionId: "drift", uid: "bot_3"},
  d: {t: 8800, role: "palette", optionId: "neon", uid: "bot_1"},
};
const results = {author: {score: 7, perRole: {}}, ai: {score: 6, comment: "", model: "canned", fallback: true}, audience: {score: 8.5, count: 4, method: "trimmed" as const}, combined: 7.2};

(async () => {
  if (process.env.TIGER_DATABASE_URL) {
    const pool = tigerPool();
    try {
      const first = await mirrorRound(pool, CODE, {round, events, results});
      console.log("(a) first:", first);
      assert.deepEqual(first, {ok: true, inserted: Object.keys(events).length});

      const again = await mirrorRound(pool, CODE, {round, events, results});
      console.log("(b) again:", again);
      assert.deepEqual(again, {ok: true, inserted: 0});

      const {rows} = await pool.query("SELECT count(*)::int AS n, (SELECT count(*)::int FROM rounds WHERE session_code = $1) AS r FROM round_events WHERE session_code = $1", [CODE]);
      assert.deepEqual(rows[0], {n: 4, r: 1});
    } finally {
      const del = await pool.query("WITH e AS (DELETE FROM round_events WHERE session_code = $1 RETURNING 1), r AS (DELETE FROM rounds WHERE session_code = $1 RETURNING 1) SELECT (SELECT count(*)::int FROM e) AS events, (SELECT count(*)::int FROM r) AS rounds", [CODE]);
      console.log("(d) cleanup deleted:", del.rows[0]);
      await pool.end();
    }
  }

  // Non-routable address: exercises the connection timeout (or a fast network error) without a key.
  const bogus = makePool("postgres://nobody:nothing@10.255.255.1:5432/none");
  const t0 = Date.now();
  const bad = await mirrorRound(bogus, CODE, {round, events, results});
  const ms = Date.now() - t0;
  console.log("(c) bogus:", bad, ms, "ms");
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && (bad.reason === "timeout" || bad.reason === "error"));
  assert.ok(ms < 6000, `bogus took ${ms} ms`);
  await bogus.end();
  console.log("logRoundEvents self-check ok");
})();
