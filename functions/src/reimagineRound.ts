import {randomUUID} from "node:crypto";
import {GoogleGenAI} from "@google/genai";
import {getDatabase} from "firebase-admin/database";
import {getDownloadURL, getStorage} from "firebase-admin/storage";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {defineSecret} from "firebase-functions/params";
import {REIMAGINE_TIMEOUT_MS} from "../../shared/contracts";
import type {Choices, Flags, Reimagined, ReimagineRoundRequest, ReimagineRoundResponse, Round, SessionMeta} from "../../shared/contracts";
import {BUNDLED_SCENES} from "../../shared/sceneLoader";

// CONTRACTS §7 reimagineRound / §8 Gemini Reimagined (D-36): after reveal, one image-editing call on the stored snapshot.
// Never on the reveal's critical path; every failure ends as results.reimagined "failed" or "skipped".
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const ROUND_RE = /^r\d{1,6}$/;
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** CONTRACTS §8 template. D-24/D-40: generic description and option labels only; never scene.title or nicknames. */
export function reimaginePrompt(description: string, paletteLabel?: string, moodWord?: string) {
  return `Re-render this exact artwork as a finished ${moodWord ? `${moodWord} ` : ""}painting of ${description}. ` +
    `Keep the composition, every shape's position and size, and the ${paletteLabel ? `${paletteLabel} ` : ""}colors. ` +
    "Do not add text, people, logos, or new objects.";
}

/** One image call inside REIMAGINE_TIMEOUT_MS; throws on error, timeout, or a reply without image data. */
export async function reimagineImage(apiKey: string, model: string, prompt: string, jpegBase64: string) {
  const res = await new GoogleGenAI({apiKey}).interactions.create({
    model,
    input: [
      {type: "text", text: prompt},
      {type: "image", mime_type: "image/jpeg", data: jpegBase64},
    ],
    response_format: {type: "image", aspect_ratio: "16:9"},
  }, {fetchOptions: {signal: AbortSignal.timeout(REIMAGINE_TIMEOUT_MS)}});
  const data = res.output_image?.data;
  if (!data) throw new Error(`no image in reply: ${res.output_text?.slice(0, 300) ?? ""}`);
  return {image: Buffer.from(data, "base64"), mimeType: res.output_image?.mime_type ?? "image/png"};
}

export const reimagineRound = onCall<ReimagineRoundRequest, Promise<ReimagineRoundResponse>>({timeoutSeconds: 90, secrets: [GEMINI_API_KEY]}, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "sign in first");
  const {sessionCode, roundId} = req.data ?? {};
  if (typeof sessionCode !== "string" || !CODE_RE.test(sessionCode) || typeof roundId !== "string" || !ROUND_RE.test(roundId)) {
    throw new HttpsError("invalid-argument", "bad request");
  }

  const db = getDatabase();
  const base = `sessions/${sessionCode}`;
  const [meta, round, flags, choices] = (await Promise.all(
    [`${base}/meta`, `${base}/round`, "config/flags", `${base}/choices`].map((p) => db.ref(p).get())
  )).map((s) => s.val()) as [SessionMeta | null, Round | null, Flags | null, Choices | null];
  if (!meta || uid !== meta.hostUid) throw new HttpsError("permission-denied", "not this session's host");
  if (!round || round.id !== roundId || round.status !== "reveal") throw new HttpsError("failed-precondition", "round is not revealed");

  const scene = BUNDLED_SCENES.find((s) => s.id === round.sceneId);
  const apiKey = GEMINI_API_KEY.value();
  const allowed = !!(flags?.reimagineEnabled && flags.imageModel && apiKey && scene &&
    (meta.usage?.reimagineCalls ?? 0) < (flags.maxReimaginePerSession ?? 0));

  // Idempotent: only the first call for a round claims the slot; later calls report what is there.
  const slot = db.ref(`${base}/results/reimagined`);
  const claim = await slot.transaction((cur) => (cur ? undefined : {status: allowed ? "pending" : "skipped"}));
  if (!claim.committed) {
    const cur = claim.snapshot.val() as Reimagined;
    return {ok: true, status: cur.status, ...(cur.url ? {url: cur.url} : {})};
  }
  if (!allowed) return {ok: true, status: "skipped"};

  /** Writes the final status only if this round is still current and still pending (T6/T7/START null results). */
  const finish = async (next: Reimagined): Promise<ReimagineRoundResponse> => {
    try {
      if ((await db.ref(`${base}/round/id`).get()).val() === roundId) {
        // Returning cur (not undefined) on a null first pass lets the server retry with the real value.
        await slot.transaction((cur) => (cur?.status === "pending" ? next : cur));
      }
    } catch (e) {
      logger.warn("reimagined status write failed", {error: String(e)});
    }
    return {ok: true, ...next};
  };

  let jpeg: Buffer;
  try {
    [jpeg] = await getStorage().bucket().file(`snapshots/${sessionCode}/${roundId}.jpg`).download();
  } catch (e) {
    logger.warn("reimagine: no snapshot", {sessionCode, roundId, error: String(e)});
    return finish({status: "skipped"});
  }

  const label = (role: "palette" | "mood") => scene!.options[role].find((o) => o.id === choices?.[role]?.optionId)?.label;
  const prompt = reimaginePrompt(scene!.description, label("palette"), label("mood"));
  try {
    // Counted before the call: a timed-out request may still be billed.
    await db.ref(`${base}/meta/usage/reimagineCalls`).transaction((n) => (n ?? 0) + 1);
    const {image, mimeType} = await reimagineImage(apiKey, flags!.imageModel, prompt, jpeg.toString("base64"));
    const file = getStorage().bucket().file(`reimagined/${sessionCode}/${roundId}.png`);
    await file.save(image, {contentType: mimeType, metadata: {metadata: {firebaseStorageDownloadTokens: randomUUID()}}});
    return finish({status: "ready", url: await getDownloadURL(file)});
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    logger.warn("reimagine failed", {model: flags!.imageModel, timedOut, error: String(e)});
    return finish({status: timedOut ? "skipped" : "failed"});
  }
});
