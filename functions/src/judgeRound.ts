import {randomUUID} from "node:crypto";
import {getDatabase} from "firebase-admin/database";
import {getDownloadURL, getStorage} from "firebase-admin/storage";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import type {AiResult, Flags, JudgeRoundRequest, JudgeRoundResponse, Results, Round, SessionMeta, Verdict} from "../../shared/contracts";

// CONTRACTS §7 judgeRound. P1-1 part 1: flags, cap, snapshot to Storage, canned verdict, idempotency.
// Voice (P1-2) is not wired, so the verdict is ready as soon as the script is written.
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const MAX_SNAPSHOT_B64 = 1_500_000;

// One canned verdict per demo scene (judge-script skill). Generic: they cannot know the chosen options.
const CANNED: Record<string, {comment: string; script: string}> = {
  "rush-hour": {
    comment: "Stuck in traffic, but the mood is moving.",
    script: "Our judge is stuck in traffic, so here is the verdict from the shoulder. This highway has not moved in ninety seconds and it still feels like it is going somewhere. The light does honest work here. Honestly, it is the most progress anyone has made on this road all year. Moody, solid, and nobody honked.",
  },
  "diner": {
    comment: "Warm light, dark lot, burnt coffee. It works.",
    script: "The judge clocked out, so the night shift is covering. This diner glows like the only open door for fifty miles, and warm light against a dark lot always lands. The coffee is probably burnt, but the composition is not. Pull up a stool, because this one earned a refill and a decent tip.",
  },
  "vigilante": {
    comment: "Brooding silhouette, clear read from the back row.",
    script: "Our judge has gone dark, which honestly suits this piece. A lone caped figure over a skyline is a classic for a reason, and the silhouette reads clearly from the back row. Is it brooding or just waiting for a rideshare? Hard to say. Either way, the city looks like it needs saving, and it looks good.",
  },
  "default": {
    comment: "The judge is offline, but the room is not.",
    script: "Our judge stepped out, so the verdict is coming from the house. Three people, three dials, ninety seconds, and the piece still holds together, which is more than most group projects manage. The colors and the motion agree with each other. Nobody asked for a masterpiece, and this one quietly showed up anyway.",
  },
};

export const judgeRound = onCall<JudgeRoundRequest, Promise<JudgeRoundResponse>>({timeoutSeconds: 30}, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "sign in first");
  const {sessionCode, roundId, snapshotJpegBase64} = req.data ?? {};
  if (typeof sessionCode !== "string" || !CODE_RE.test(sessionCode) || typeof roundId !== "string" ||
    typeof snapshotJpegBase64 !== "string" || snapshotJpegBase64.length > MAX_SNAPSHOT_B64) {
    throw new HttpsError("invalid-argument", "bad request");
  }
  const jpeg = Buffer.from(snapshotJpegBase64, "base64");
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new HttpsError("invalid-argument", "snapshot is not a JPEG");

  const db = getDatabase();
  const base = `sessions/${sessionCode}`;
  const [meta, round, results, flags] = (await Promise.all(
    [`${base}/meta`, `${base}/round`, `${base}/results`, "config/flags"].map((p) => db.ref(p).get())
  )).map((s) => s.val()) as [SessionMeta | null, Round | null, Results | null, Flags | null];
  if (!meta || (uid !== meta.hostUid && uid !== meta.screenUid)) throw new HttpsError("permission-denied", "not this session's host or screen");
  if (!round || round.id !== roundId || (round.status !== "locked" && round.status !== "rating")) {
    throw new HttpsError("failed-precondition", "round is not awaiting a verdict");
  }
  if (results?.ai) throw new HttpsError("already-exists", "already judged");

  let snapshotUrl = "";
  try {
    const file = getStorage().bucket().file(`snapshots/${sessionCode}/${roundId}.jpg`);
    await file.save(jpeg, {contentType: "image/jpeg", metadata: {metadata: {firebaseStorageDownloadTokens: randomUUID()}}});
    snapshotUrl = await getDownloadURL(file);
  } catch (e) {
    logger.warn("snapshot upload failed", e);
  }

  const canned = CANNED[round.sceneId] ?? CANNED.default;
  if (flags?.aiEnabled && (meta.usage?.judgeCalls ?? 0) < (flags.maxJudgeCallsPerSession ?? 0)) {
    await db.ref(`${base}/meta/usage/judgeCalls`).transaction((n) => (n ?? 0) + 1);
    // TODO(P1-1 part 2): one Gemini structured call (GEMINI_TIMEOUT_MS) + post-validation; canned until then.
  }
  const ai: AiResult = {score: 6, comment: canned.comment, model: "canned", fallback: true};
  const verdict: Verdict = {script: canned.script, audioUrl: null, ready: true, fallback: true};

  // Host may have reset or started the next round while we worked; never write into someone else's round.
  if ((await db.ref(`${base}/round/id`).get()).val() !== roundId) throw new HttpsError("failed-precondition", "round moved on");
  const {committed} = await db.ref(`${base}/results/ai`).transaction((cur) => (cur ? undefined : ai));
  if (!committed) throw new HttpsError("already-exists", "already judged");
  await db.ref(`${base}/results`).update({verdict, snapshotUrl: snapshotUrl || null});
  return {ok: true, ai: {score: ai.score, comment: ai.comment, fallback: ai.fallback}, verdict, snapshotUrl};
});
