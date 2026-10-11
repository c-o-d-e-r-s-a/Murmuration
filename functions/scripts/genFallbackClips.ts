// One-shot (P1-8, D-25): ElevenLabs TTS for each canned verdict -> Storage fallback/{sceneId}/{n}.mp3.
// Not on the live path. Run from the repo root (PowerShell):
//   $env:ELEVENLABS_API_KEY = Read-Host "ElevenLabs key"      # never stored in the repo
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"   # gitignored location
//   $env:STORAGE_BUCKET = "murmuration-33d60.firebasestorage.app"            # or *.appspot.com, see console
//   npx tsx functions/scripts/genFallbackClips.ts [--force]
// Skips objects that already exist unless --force.
import {randomUUID} from "node:crypto";
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {CANNED} from "../src/cannedVerdicts";

const key = process.env.ELEVENLABS_API_KEY ?? "";
const bucketName = process.env.STORAGE_BUCKET;
if (!key || !bucketName) throw new Error("set ELEVENLABS_API_KEY and STORAGE_BUCKET");
const voiceId = process.env.TTS_VOICE_ID ?? "3IwIPyXc0WRkgKBE8KXP";
const modelId = process.env.TTS_MODEL_ID ?? "eleven_v4_turbo";
const force = process.argv.includes("--force");

initializeApp({storageBucket: bucketName});
const bucket = getStorage().bucket();

async function main() {
for (const [sceneId, clips] of Object.entries(CANNED)) {
  if (sceneId === "default") continue;
  for (const [n, clip] of clips.entries()) {
    const path = `fallback/${sceneId}/${n}.mp3`;
    const file = bucket.file(path);
    if (!force && (await file.exists())[0]) {
      console.log("skip  ", path);
      continue;
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: {"xi-api-key": key, "Content-Type": "application/json"},
      body: JSON.stringify({text: clip.script, model_id: modelId, voice_settings: {stability: 0.5, similarity_boost: 0.75, style: 0.3, speed: 1.05}}),
    });
    if (!res.ok) throw new Error(`${path}: ElevenLabs ${res.status} ${(await res.text()).slice(0, 300)}`);
    const mp3 = Buffer.from(await res.arrayBuffer());
    await file.save(mp3, {contentType: "audio/mpeg", metadata: {metadata: {firebaseStorageDownloadTokens: randomUUID()}}});
    console.log("upload", `gs://${bucketName}/${path}`, mp3.length, "bytes");
  }
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
