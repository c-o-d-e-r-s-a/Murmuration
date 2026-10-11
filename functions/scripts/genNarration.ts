// One-shot (P2-4): ElevenLabs TTS of the demo walkthrough -> Storage narration/demo-walkthrough.mp3.
// Not on the live path; /host just plays the static file. API cost is incurred once at generate time.
// Run from the repo root (PowerShell):
//   Get-Content functions/.secret.local | ForEach-Object { if ($_ -match '^\s*([^#=]+)\s*=\s*(.+)$') { Set-Item "env:$($Matches[1].Trim())" $Matches[2].Trim() } }
//   $env:STORAGE_BUCKET = "murmuration-33d60.firebasestorage.app"
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"   # needed for Storage upload
//   npx tsx functions/scripts/genNarration.ts [--force] [--local]   # --local = write mp3 only, skip Storage
import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";

const SCRIPT = [
  "Welcome to Murmuration. One shared artwork, three dials, and everyone in the room gets a say.",
  "In the lobby, scan the code and pick a nickname. Up to three of you become Creators, and each one owns a single dial: palette, form, or motion. Everyone else is a Spectator.",
  "When the round goes live, Creators choose their option, and the artwork on the big screen eases toward the flock's choices. Sixty seconds, no take-backs.",
  "When time is up, the art locks and Spectators rate it. Tap a star rating, one vote each.",
  "Then the reveal. Three judges weigh in: the Scene Author's taste, an A.I. critic, and the audience. The scores combine, and the verdict is read out loud.",
  "That's a round. Start another, and see what a different flock makes.",
].join("\n\n");

const key = process.env.ELEVENLABS_API_KEY ?? "";
if (!key) throw new Error("set ELEVENLABS_API_KEY");
const bucketName = process.env.STORAGE_BUCKET;
const localOnly = process.argv.includes("--local");
if (!localOnly && !bucketName) throw new Error("set STORAGE_BUCKET (or pass --local)");
const voiceId = process.env.TTS_VOICE_ID ?? "3IwIPyXc0WRkgKBE8KXP";
const modelId = process.env.TTS_MODEL_ID ?? "eleven_v4_turbo";
const path = "narration/demo-walkthrough.mp3";
const localPath = join(dirname(fileURLToPath(import.meta.url)), "out", "demo-walkthrough.mp3");

async function synthesize(): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: {"xi-api-key": key, "Content-Type": "application/json"},
    body: JSON.stringify({text: SCRIPT, model_id: modelId, voice_settings: {stability: 0.5, similarity_boost: 0.75, style: 0.3, speed: 1.0}}),
  });
  if (!res.ok) throw new Error(`${path}: ElevenLabs ${res.status} ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!localOnly) {
    initializeApp({storageBucket: bucketName});
    const file = getStorage().bucket().file(path);
    if (!process.argv.includes("--force") && (await file.exists())[0]) return console.log("skip  ", path);
    const mp3 = await synthesize();
    mkdirSync(dirname(localPath), {recursive: true});
    writeFileSync(localPath, mp3);
    await file.save(mp3, {contentType: "audio/mpeg"});
    console.log("local ", localPath, mp3.length, "bytes");
    console.log("upload", `gs://${bucketName}/${path}`, mp3.length, "bytes");
    return;
  }
  const mp3 = await synthesize();
  mkdirSync(dirname(localPath), {recursive: true});
  writeFileSync(localPath, mp3);
  console.log("local ", localPath, mp3.length, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
