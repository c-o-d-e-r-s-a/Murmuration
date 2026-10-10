import {createHash, randomUUID} from "node:crypto";
import {GoogleGenAI} from "@google/genai";
import {getDatabase} from "firebase-admin/database";
import {getDownloadURL, getStorage} from "firebase-admin/storage";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {defineSecret} from "firebase-functions/params";
import {GEMINI_TIMEOUT_MS, ROLES, TTS_TIMEOUT_MS, VERDICT_WORDS_MAX, VERDICT_WORDS_MIN} from "../../shared/contracts";
import type {AiResult, Choices, Flags, JudgeRoundRequest, JudgeRoundResponse, Results, Round, SessionMeta, Verdict} from "../../shared/contracts";
import {BUNDLED_SCENES} from "../../shared/sceneLoader";
import {aiScore} from "../../shared/scoring";

// CONTRACTS §7 judgeRound: flags, cap, snapshot to Storage, one Gemini call (§8), canned fallback, idempotency,
// then verdict audio (ElevenLabs, cached by script hash, D-25); verdict.ready only once the audio decision is made.
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const MAX_SNAPSHOT_B64 = 1_500_000;
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");

// CONTRACTS §8 response schema.
const SCHEMA = {
  type: "object",
  properties: {
    score: {type: "integer", minimum: 1, maximum: 10},
    comment: {type: "string", maxLength: 140},
    script: {type: "string"},
  },
  required: ["score", "comment", "script"],
};

const PROMPT = `You are the AI judge of a live party game. A few players each set one dial (palette, form, motion) of one shared artwork; the image is the finished artwork.
Facts (JSON): scene is what the artwork shows, prompt is the task they were given, choices maps each dial to the option label they picked, unfilledRoles were left neutral.
Return JSON:
- score: integer 1-10, how well the artwork answers the prompt.
- comment: one line, at most 140 characters.
- script: a spoken verdict of ${VERDICT_WORDS_MIN}-${VERDICT_WORDS_MAX} words. Name at least two of the chosen option labels exactly as written. One joke and one genuine observation. Talk about the artwork and the choices, never about people. Do not mention the audience or any audience score. No preamble, no quotes.
Facts: `;

type Judged = {score: number; comment: string; script: string};

/** CONTRACTS §8 post-validation of one Gemini reply; null when out of spec. */
export function parseVerdict(text: string | undefined, labels: string[]): Judged | null {
  let out: {score?: unknown; comment?: unknown; script?: unknown};
  try {
    out = JSON.parse(text ?? "");
  } catch {
    return null;
  }
  const score = aiScore(out?.score);
  const comment = typeof out?.comment === "string" ? out.comment.trim() : "";
  const script = typeof out?.script === "string" ? out.script.trim() : "";
  const words = script.split(/\s+/).filter(Boolean).length;
  const cited = labels.filter((l) => script.toLowerCase().includes(l.toLowerCase())).length;
  if (score.fallback || !comment || words < VERDICT_WORDS_MIN || words > VERDICT_WORDS_MAX || cited < Math.min(2, labels.length)) return null;
  return {score: score.score, comment: comment.slice(0, 140), script};
}

/** Tries each model in order inside one GEMINI_TIMEOUT_MS budget; null means use the canned verdict. */
export async function askGemini(models: string[], facts: object, labels: string[], jpegBase64: string): Promise<(Judged & {model: string}) | null> {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) return null;
  const client = new GoogleGenAI({apiKey});
  const deadline = Date.now() + GEMINI_TIMEOUT_MS;
  for (const model of models) {
    const ms = deadline - Date.now();
    if (ms < 1000) break;
    try {
      const res = await client.interactions.create({
        model,
        input: [
          {type: "text", text: PROMPT + JSON.stringify(facts)},
          {type: "image", mime_type: "image/jpeg", data: jpegBase64},
        ],
        response_format: {type: "text", mime_type: "application/json", schema: SCHEMA},
      }, {fetchOptions: {signal: AbortSignal.timeout(ms)}});
      const judged = parseVerdict(res.output_text, labels);
      if (judged) return {...judged, model};
      logger.warn("gemini reply out of spec", {model, text: res.output_text?.slice(0, 600)});
    } catch (e) {
      logger.warn("gemini call failed", {model, error: String(e)});
    }
  }
  return null;
}

/** CONTRACTS §8 ElevenLabs TTS; null on any error or after TTS_TIMEOUT_MS. Only the script goes out (D-24). */
export async function ttsMp3(script: string, voiceId: string, modelId: string): Promise<Buffer | null> {
  const apiKey = ELEVENLABS_API_KEY.value();
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: {"xi-api-key": apiKey, "Content-Type": "application/json"},
      body: JSON.stringify({text: script, model_id: modelId, voice_settings: {stability: 0.5, similarity_boost: 0.75, style: 0.3, speed: 1.05}}),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn("tts reply not ok", {status: res.status, body: (await res.text()).slice(0, 300)});
      return null;
    }
    const mp3 = Buffer.from(await res.arrayBuffer());
    return mp3.length ? mp3 : null;
  } catch (e) {
    logger.warn("tts call failed", {error: String(e)});
    return null;
  }
}

async function urlIfExists(path: string): Promise<string | null> {
  try {
    const file = getStorage().bucket().file(path);
    const [exists] = await file.exists();
    return exists ? await getDownloadURL(file) : null;
  } catch (e) {
    logger.warn("storage url failed", {path, error: String(e)});
    return null;
  }
}

/** CONTRACTS §7 step 5: cached clip, else fresh ElevenLabs clip, else the scene's fallback clip, else null. Never throws. */
async function verdictAudio(script: string, sceneId: string, flags: Flags | null, ttsCharsUsed: number, base: string): Promise<string | null> {
  const fallback = () => urlIfExists(`fallback/${sceneId}/0.mp3`);
  try {
    if (!flags?.voiceEnabled || !flags.ttsVoiceId || !flags.ttsModelId) return await fallback();
    const path = `verdicts/${createHash("sha256").update(script).digest("hex")}.mp3`;
    const cached = await urlIfExists(path);
    if (cached) return cached;
    if (ttsCharsUsed + script.length > (flags.maxTtsCharsPerSession ?? 0)) return await fallback();
    // Counted before the call: a timed-out request may still be billed.
    await getDatabase().ref(`${base}/meta/usage/ttsChars`).transaction((n) => (n ?? 0) + script.length);
    const mp3 = await ttsMp3(script, flags.ttsVoiceId, flags.ttsModelId);
    if (!mp3) return await fallback();
    const file = getStorage().bucket().file(path);
    await file.save(mp3, {contentType: "audio/mpeg", metadata: {metadata: {firebaseStorageDownloadTokens: randomUUID()}}});
    return await getDownloadURL(file);
  } catch (e) {
    logger.warn("verdict audio failed", {error: String(e)});
    return await fallback();
  }
}

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

export const judgeRound = onCall<JudgeRoundRequest, Promise<JudgeRoundResponse>>({timeoutSeconds: 30, secrets: [GEMINI_API_KEY, ELEVENLABS_API_KEY]}, async (req) => {
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
  const [meta, round, results, flags, choices] = (await Promise.all(
    [`${base}/meta`, `${base}/round`, `${base}/results`, "config/flags", `${base}/choices`].map((p) => db.ref(p).get())
  )).map((s) => s.val()) as [SessionMeta | null, Round | null, Results | null, Flags | null, Choices | null];
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
  const scene = BUNDLED_SCENES.find((s) => s.id === round.sceneId);
  let judged: Awaited<ReturnType<typeof askGemini>> = null;
  if (scene && flags?.aiEnabled && (meta.usage?.judgeCalls ?? 0) < (flags.maxJudgeCallsPerSession ?? 0)) {
    await db.ref(`${base}/meta/usage/judgeCalls`).transaction((n) => (n ?? 0) + 1);
    // D-24/D-40: only the generic description and option labels go out; never scene.title or nicknames.
    const picked: Record<string, string> = {};
    for (const r of ROLES) {
      const label = scene.options[r].find((o) => o.id === choices?.[r]?.optionId)?.label;
      if (label) picked[r] = label;
    }
    const facts = {scene: scene.description, prompt: round.promptText, choices: picked, unfilledRoles: ROLES.filter((r) => !picked[r])};
    const models = [...new Set([flags.geminiModel, flags.geminiFallbackModel].filter(Boolean))];
    judged = await askGemini(models, facts, Object.values(picked), snapshotJpegBase64);
  }
  const ai: AiResult = judged ?
    {score: judged.score, comment: judged.comment, model: judged.model, fallback: false} :
    {score: 6, comment: canned.comment, model: "canned", fallback: true};
  const verdict: Verdict = {script: judged?.script ?? canned.script, audioUrl: null, ready: false, fallback: !judged};

  // Host may have reset or started the next round while we worked; never write into someone else's round.
  if ((await db.ref(`${base}/round/id`).get()).val() !== roundId) throw new HttpsError("failed-precondition", "round moved on");
  const {committed} = await db.ref(`${base}/results/ai`).transaction((cur) => (cur ? undefined : ai));
  if (!committed) throw new HttpsError("already-exists", "already judged");
  await db.ref(`${base}/results`).update({verdict, snapshotUrl: snapshotUrl || null});

  verdict.audioUrl = await verdictAudio(verdict.script, round.sceneId, flags, meta.usage?.ttsChars ?? 0, base);
  verdict.ready = true;
  if ((await db.ref(`${base}/round/id`).get()).val() !== roundId) throw new HttpsError("failed-precondition", "round moved on");
  await db.ref(`${base}/results/verdict`).update({audioUrl: verdict.audioUrl, ready: true});
  return {ok: true, ai: {score: ai.score, comment: ai.comment, fallback: ai.fallback}, verdict, snapshotUrl};
});
