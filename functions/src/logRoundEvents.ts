import {createHash} from "node:crypto";
import {getDatabase} from "firebase-admin/database";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import type {Pool} from "pg";
import type {ChoiceEvent, LogRoundEventsRequest, LogRoundEventsResponse, Results, Round} from "../../shared/contracts";
import {TIGER_DATABASE_URL, tigerFailure, tigerPool} from "./lib/tiger";

// CONTRACTS §7 logRoundEvents / DATA_SCHEMA §8: mirror one finished round into Tiger. Never on the live path.
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const ROUND_RE = /^r\d{1,6}$/;

export type RoundSource = {round: Round; events?: Record<string, ChoiceEvent> | null; results?: Results | null};

// Both inserts in one statement (one round trip, one statement_timeout); unnest keeps zero events valid SQL.
const SQL = `WITH r AS (
  INSERT INTO rounds (session_code, round_id, scene_id, prompt_id, duration_ms, creators, author, ai, audience, combined, locked_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT DO NOTHING
), e AS (
  INSERT INTO round_events (time, session_code, round_id, role, option_id, uid_hash, t_ms)
  SELECT u.time, $1::text, $2::text, u.role, u.option_id, u.uid_hash, u.t_ms
  FROM unnest($12::timestamptz[], $13::text[], $14::text[], $15::text[], $16::int[]) AS u(time, role, option_id, uid_hash, t_ms)
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT count(*)::int AS inserted FROM e`;

/** D-24: Tiger gets a short uid hash, never a nickname or the raw uid. */
export const uidHash = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 8);

/** Inserts one round; never throws. inserted counts new round_events rows (0 on a re-run). */
export async function mirrorRound(pool: Pool, sessionCode: string, {round, events, results}: RoundSource): Promise<LogRoundEventsResponse> {
  try {
    const {startsAt, lockedAt} = round;
    if (!startsAt || !lockedAt) throw new Error("round has no startsAt or lockedAt");
    const evs = Object.values(events ?? {});
    const t = evs.map((e) => Math.round(e.t));
    const {rows} = await pool.query<{inserted: number}>(SQL, [
      sessionCode, round.id, round.sceneId, round.promptId, round.durationMs, Object.keys(round.slots ?? {}).length,
      results?.author?.score ?? null, results?.ai?.score ?? null, results?.audience?.score ?? null, results?.combined ?? null,
      new Date(lockedAt),
      t.map((ms) => new Date(startsAt + ms)), evs.map((e) => e.role), evs.map((e) => e.optionId), evs.map((e) => uidHash(e.uid)), t,
    ]);
    return {ok: true, inserted: rows[0].inserted};
  } catch (e) {
    return {ok: false, reason: tigerFailure(e)};
  }
}

export const logRoundEvents = onCall<LogRoundEventsRequest, Promise<LogRoundEventsResponse>>({timeoutSeconds: 15, secrets: [TIGER_DATABASE_URL]}, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "sign in first");
  const {sessionCode, roundId} = req.data ?? {};
  if (typeof sessionCode !== "string" || !CODE_RE.test(sessionCode) || typeof roundId !== "string" || !ROUND_RE.test(roundId)) {
    return {ok: false, reason: "error"};
  }

  const db = getDatabase();
  const base = `sessions/${sessionCode}`;
  const read = (p: string) => db.ref(p).get().then((s) => s.val());
  let hostUid: string | null, tigerEnabled: boolean | null, archived: Round | null, live: Round | null;
  try {
    [hostUid, tigerEnabled, archived, live] = await Promise.all(
      [`${base}/meta/hostUid`, "config/flags/tigerEnabled", `${base}/rounds/${roundId}/round`, `${base}/round`].map(read));
  } catch (e) {
    logger.warn("logRoundEvents rtdb read failed", {error: String(e)});
    return {ok: false, reason: "error"};
  }
  if (!hostUid || uid !== hostUid) throw new HttpsError("permission-denied", "not this session's host");
  if (!tigerEnabled) return {ok: false, reason: "disabled"};

  // Archived copy wins; else the live round, but only once it is revealed.
  const at = archived ? `${base}/rounds/${roundId}` : live?.id === roundId && live.status === "reveal" ? base : null;
  const round = archived ?? live;
  if (!at || !round) {
    logger.warn("logRoundEvents: round not revealed or archived", {sessionCode, roundId});
    return {ok: false, reason: "error"};
  }
  let events: RoundSource["events"], results: RoundSource["results"];
  try {
    [events, results] = await Promise.all([`${at}/events`, `${at}/results`].map(read));
  } catch (e) {
    logger.warn("logRoundEvents rtdb read failed", {error: String(e)});
    return {ok: false, reason: "error"};
  }
  return mirrorRound(tigerPool(), sessionCode, {round, events, results});
});
