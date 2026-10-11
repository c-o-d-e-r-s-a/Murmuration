// Self-check for the pulse read: live read after a mirrored round, bogus URL goes stale in time, cleanup.
// npx tsx --env-file=functions/.secret.local functions/src/sessionPulse.test.ts   (omit --env-file for offline only)
import assert from "node:assert/strict";
import {TIGER_TIMEOUT_MS, type ChoiceEvent, type Round} from "../../shared/contracts";
import {makePool, tigerPool} from "./lib/tiger";
import {mirrorRound} from "./logRoundEvents";
import {readPulse, stalePulse} from "./sessionPulse";

// "SELFTEST" can never be a real 4-char session code, so cleanup cannot touch real rows.
const CODE = "SELFTEST";
// Recent, so the events land inside the 15-minute bucket window.
const startsAt = Date.now() - 120000;
const round: Round = {
  id: "r1", sceneId: "rush-hour", promptId: "p1", promptText: "x", seed: 1, durationMs: 90000, status: "reveal",
  startsAt, lockedAt: startsAt + 90000, ratingEndsAt: null, slots: {palette: "bot_1", form: "bot_2", motion: "bot_3"}, statusVersion: 5,
};
const events: Record<string, ChoiceEvent> = {
  a: {t: 1200, role: "palette", optionId: "peach", uid: "bot_1"},
  b: {t: 3400, role: "form", optionId: "fog", uid: "bot_2"},
  c: {t: 5100, role: "motion", optionId: "drift", uid: "bot_3"},
  d: {t: 8800, role: "palette", optionId: "neon", uid: "bot_1"},
  e: {t: 9900, role: "palette", optionId: "neon", uid: "bot_1"},
};
const results = {author: {score: 7, perRole: {}}, ai: {score: 6, comment: "", model: "canned", fallback: true}, audience: {score: 8.5, count: 4, method: "trimmed" as const}, combined: 7.2};

(async () => {
  if (process.env.TIGER_DATABASE_URL) {
    const pool = tigerPool();
    try {
      const empty = await readPulse(pool, CODE);
      console.log("(a) before mirror:", JSON.stringify(empty));
      assert.deepEqual(empty, {...stalePulse(), stale: false});

      assert.deepEqual(await mirrorRound(pool, CODE, {round, events, results}), {ok: true, inserted: 5});
      const pulse = await readPulse(pool, CODE);
      console.log("(b) after mirror:", JSON.stringify(pulse, null, 2));
      assert.equal(pulse.stale, false);
      assert.equal(pulse.buckets.reduce((s, b) => s + b.n, 0), 5);
      assert.deepEqual(new Set(pulse.buckets.map((b) => b.role)), new Set(["palette", "form", "motion"]));
      for (const b of pulse.buckets) assert.match(b.t, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
      assert.deepEqual(pulse.topOptions, {palette: {optionId: "neon", n: 2}, form: {optionId: "fog", n: 1}, motion: {optionId: "drift", n: 1}});
      assert.deepEqual(pulse.rounds, {played: 1, avgCombined: 7.2, lastLockedAt: new Date(round.lockedAt).toISOString()});
    } finally {
      const del = await pool.query("WITH e AS (DELETE FROM round_events WHERE session_code = $1 RETURNING 1), r AS (DELETE FROM rounds WHERE session_code = $1 RETURNING 1) SELECT (SELECT count(*)::int FROM e) AS events, (SELECT count(*)::int FROM r) AS rounds", [CODE]);
      console.log("(d) cleanup deleted:", del.rows[0]);
      await pool.end();
    }
  }

  // Non-routable address: exercises the deadline (or a fast network error) without a key.
  const bogus = makePool("postgres://nobody:nothing@10.255.255.1:5432/none");
  const t0 = Date.now();
  const bad = await readPulse(bogus, CODE);
  const ms = Date.now() - t0;
  console.log("(c) bogus:", JSON.stringify(bad), ms, "ms");
  assert.deepEqual(bad, stalePulse());
  assert.ok(ms < TIGER_TIMEOUT_MS + 500, `bogus took ${ms} ms`);
  await bogus.end();
  console.log("sessionPulse self-check ok");
})();
