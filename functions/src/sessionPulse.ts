import {getDatabase} from "firebase-admin/database";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import type {Pool} from "pg";
import {TIGER_TIMEOUT_MS, type Role, type SessionPulseRequest, type SessionPulseResponse} from "../../shared/contracts";
import {TIGER_DATABASE_URL, tigerFailure, tigerPool} from "./lib/tiger";

// CONTRACTS §7 sessionPulse / DATA_SCHEMA §8: read-only host panel feed. Never on the live path; no RTDB writes.
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

// All three reads in one statement: one client (pool max is 2), one round trip, one statement_timeout.
const SQL = `SELECT
  (SELECT coalesce(json_agg(json_build_object('t', bucket, 'role', role, 'n', n) ORDER BY bucket, role), '[]')
     FROM choices_10s WHERE session_code = $1 AND bucket > now() - interval '15 minutes') AS buckets,
  (SELECT coalesce(json_agg(json_build_object('role', role, 'optionId', option_id, 'n', n)), '[]')
     FROM (SELECT DISTINCT ON (role) role, option_id, count(*)::int AS n FROM round_events WHERE session_code = $1
           GROUP BY role, option_id ORDER BY role, count(*) DESC, option_id) top) AS top,
  (SELECT json_build_object('played', count(*)::int, 'avgCombined', round(avg(combined), 1), 'lastLockedAt', max(locked_at))
     FROM rounds WHERE session_code = $1) AS rounds`;

type Row = {
  buckets: {t: string; role: Role; n: number}[];
  top: {role: Role; optionId: string; n: number}[];
  rounds: {played: number; avgCombined: number | null; lastLockedAt: string | null};
};

export const stalePulse = (): SessionPulseResponse =>
  ({stale: true, buckets: [], topOptions: {}, rounds: {played: 0, avgCombined: null, lastLockedAt: null}});

const iso = (t: string) => new Date(t).toISOString();

/** Never throws; any Tiger failure or a wait past TIGER_TIMEOUT_MS returns stalePulse(). */
export async function readPulse(pool: Pool, sessionCode: string): Promise<SessionPulseResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("tiger timeout")), TIGER_TIMEOUT_MS);
  });
  try {
    const {rows} = await Promise.race([pool.query<Row>(SQL, [sessionCode]), deadline]);
    const {buckets, top, rounds} = rows[0];
    return {
      stale: false,
      buckets: buckets.map((b) => ({t: iso(b.t), role: b.role, n: Number(b.n)})),
      topOptions: Object.fromEntries(top.map((o) => [o.role, {optionId: o.optionId, n: o.n}])),
      rounds: {
        played: rounds.played,
        avgCombined: rounds.avgCombined === null ? null : Number(rounds.avgCombined),
        lastLockedAt: rounds.lastLockedAt === null ? null : iso(rounds.lastLockedAt),
      },
    };
  } catch (e) {
    tigerFailure(e);
    return stalePulse();
  } finally {
    clearTimeout(timer);
  }
}

export const sessionPulse = onCall<SessionPulseRequest, Promise<SessionPulseResponse>>({timeoutSeconds: 10, secrets: [TIGER_DATABASE_URL]}, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "sign in first");
  const {sessionCode} = req.data ?? {};
  if (typeof sessionCode !== "string" || !CODE_RE.test(sessionCode)) throw new HttpsError("invalid-argument", "bad request");

  const db = getDatabase();
  const read = (p: string) => db.ref(p).get().then((s) => s.val());
  let hostUid: string | null, tigerEnabled: boolean | null;
  try {
    [hostUid, tigerEnabled] = await Promise.all([`sessions/${sessionCode}/meta/hostUid`, "config/flags/tigerEnabled"].map(read));
  } catch (e) {
    logger.warn("sessionPulse rtdb read failed", {error: String(e)});
    return stalePulse();
  }
  if (!hostUid || uid !== hostUid) throw new HttpsError("permission-denied", "not this session's host");
  if (!tigerEnabled) return stalePulse();
  return readPulse(tigerPool(), sessionCode);
});
