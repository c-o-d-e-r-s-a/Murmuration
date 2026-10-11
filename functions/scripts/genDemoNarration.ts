// One-shot: ElevenLabs TTS of the /demo walkthrough, one MP3 per step -> web/public/narration/demo/step-NN.mp3.
// Served by Hosting as static files; /demo plays step-NN.mp3 on step enter and degrades to the caption if a file is missing.
// Not on the live path. The key never leaves this machine; API cost is incurred once at generate time.
// Run from the repo root (PowerShell):
//   Get-Content functions/.secret.local | ForEach-Object { if ($_ -match '^\s*([^#=]+)\s*=\s*(.+)$') { Set-Item "env:$($Matches[1].Trim())" $Matches[2].Trim() } }
//   npx tsx functions/scripts/genDemoNarration.ts [--force] [--local] [--only=3]
//   --force  regenerate files that already exist      --only=N  just step N (1-based)
//   --local  accepted for parity with genNarration.ts; this script only ever writes local files (no Storage).
// Keep SCRIPT in sync with STEPS[].text in web/demo/main.ts (that text is the on-screen caption).
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT = [
  "Welcome to Murmuration. Three strangers, three dials, one artwork on the big screen, and everyone else judges. Tonight you get all three dials, because it's a demo and nobody's watching.",
  "You hold the Palette dial. Four options, one tap. Pick a mood for the light and watch the screen ease into it. Nothing snaps; everything glides.",
  "Now you're on Form: what the air is made of. Smog, sparks, steam or dust. Change your mind as often as you like until the lock.",
  "Last dial: Motion. How the whole thing breathes. Nothing here flickers faster than three times a second. We checked, twice.",
  "Time's up. Hands off. The artwork settles for a moment and the dials go dark. Whatever you built is what gets judged.",
  "Now the room weighs in. Spectators rate one to five, once, no takebacks. Go on, be honest. Be kind. Be at least a little kind.",
  "Three judges. The Scene Author ranked every option before you arrived. The A.I. judge looks at the picture and writes a verdict. The audience is the audience. Average them, and that's your score.",
  "That's a round. About ninety seconds in real life. Grab a laptop, host a session, and let the room take the dials.",
];

const key = process.env.ELEVENLABS_API_KEY ?? "";
if (!key) throw new Error("set ELEVENLABS_API_KEY");
const voiceId = process.env.TTS_VOICE_ID ?? "3IwIPyXc0WRkgKBE8KXP";
const modelId = process.env.TTS_MODEL_ID ?? "eleven_v4_turbo";
const force = process.argv.includes("--force");
const only = Number(process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? 0);
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "public", "narration", "demo");

async function synthesize(text: string, name: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: {"xi-api-key": key, "Content-Type": "application/json"},
    body: JSON.stringify({text, model_id: modelId, voice_settings: {stability: 0.5, similarity_boost: 0.75, style: 0.35, speed: 1.0}}),
  });
  if (!res.ok) throw new Error(`${name}: ElevenLabs ${res.status} ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync(outDir, {recursive: true});
  for (const [i, text] of SCRIPT.entries()) {
    const n = i + 1;
    if (only && only !== n) continue;
    const name = `step-${String(n).padStart(2, "0")}.mp3`;
    const file = join(outDir, name);
    if (!force && existsSync(file)) { console.log("skip  ", name); continue; }
    const mp3 = await synthesize(text, name);
    writeFileSync(file, mp3);
    console.log("wrote ", file, mp3.length, "bytes");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
