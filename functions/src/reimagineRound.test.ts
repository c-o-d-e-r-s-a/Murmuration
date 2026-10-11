// Self-check for the Reimagined prompt; with GEMINI_API_KEY set it also makes one live image call (~$0.03, needs Prepay billing) and one forced failure.
// npx tsx --env-file=functions/.secret.local functions/src/reimagineRound.test.ts   (omit --env-file for offline only)
import assert from "node:assert/strict";
import {BUNDLED_SCENES} from "../../shared/sceneLoader";
import {reimagineImage, reimaginePrompt} from "./reimagineRound";

const full = reimaginePrompt("a roadside diner at night", "Neon Rush", "lonely");
assert.match(full, /finished lonely painting of a roadside diner at night\./);
assert.match(full, /the Neon Rush colors\./);
assert.match(full, /Keep the composition/);
const bare = reimaginePrompt("a city street at rush hour");
assert.match(bare, /finished painting of a city street at rush hour\./);
assert.match(bare, /size, and the colors\./);
assert.doesNotMatch(bare, /undefined/);

(async () => {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    // 1x1 JPEG; enough for the API to accept the image part.
    const jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const scene = BUNDLED_SCENES[0];
    const t0 = Date.now();
    const out = await reimagineImage(key, "gemini-nano-banana-2.1", reimaginePrompt(scene.description, scene.options.palette[0].label), jpeg);
    console.log("live:", Date.now() - t0, "ms", out.mimeType, out.image.length, "bytes");
    assert.ok(out.image.length > 1000, "live image call returned no image");
    await assert.rejects(reimagineImage(key, "no-such-model", "x", jpeg));
  }
  console.log("reimagineRound self-check ok");
})();
