// Self-check for judgeRound post-validation; with GEMINI_API_KEY set it also makes one live call and one forced failure.
// npx tsx --env-file=functions/.secret.local functions/src/judgeRound.test.ts   (omit --env-file for offline only)
import assert from "node:assert/strict";
import {BUNDLED_SCENES} from "../../shared/sceneLoader";
import {askGemini, parseVerdict} from "./judgeRound";

const labels = ["Peach Sunset", "Low Fog", "Slow Drift"];
const words = (n: number) => Array.from({length: n}, () => "word").join(" ");
const reply = (o: object) => JSON.stringify({score: 7, comment: "Calm traffic.", script: `Peach Sunset meets Low Fog. ${words(40)}`, ...o});

assert.deepEqual(parseVerdict(reply({}), labels)?.score, 7);
assert.equal(parseVerdict(reply({score: 14}), labels)?.score, 10); // clamped, CONTRACTS §4
assert.equal(parseVerdict(reply({score: "7"}), labels), null);
assert.equal(parseVerdict(reply({comment: ""}), labels), null);
assert.equal(parseVerdict(reply({script: `Peach Sunset meets Low Fog. ${words(10)}`}), labels), null); // too short
assert.equal(parseVerdict(reply({script: `Peach Sunset meets Low Fog. ${words(60)}`}), labels), null); // too long
assert.equal(parseVerdict(reply({script: `Only Peach Sunset here. ${words(40)}`}), labels), null); // one label
assert.ok(parseVerdict(reply({script: `Only Peach Sunset here. ${words(40)}`}), ["Peach Sunset"])); // only one was chosen
assert.ok(parseVerdict(reply({script: words(45)}), [])); // nobody picked anything
assert.equal(parseVerdict("not json", labels), null);
assert.equal(parseVerdict(undefined, labels), null);
assert.equal(parseVerdict(reply({comment: "x".repeat(200)}), labels)?.comment.length, 140);

(async () => {
  if (process.env.GEMINI_API_KEY) {
    // 1x1 JPEG; enough for the API to accept the image part.
    const jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const scene = BUNDLED_SCENES[0];
    const picked = {palette: scene.options.palette[0].label, form: scene.options.form[0].label, motion: scene.options.motion[0].label};
    const facts = {scene: scene.description, prompt: scene.prompts[0].text, choices: picked, unfilledRoles: ["texture", "mood"]};
    const t0 = Date.now();
    const live = await askGemini(["gemini-3.8-flash", "gemini-3.5-flash-lite"], facts, Object.values(picked), jpeg);
    console.log("live:", Date.now() - t0, "ms", live);
    assert.ok(live, "live Gemini call returned nothing valid");
    assert.equal(await askGemini(["no-such-model"], facts, Object.values(picked), jpeg), null);
  }
  console.log("judgeRound self-check ok");
})();
