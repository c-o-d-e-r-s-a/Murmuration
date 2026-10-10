import type { Choices } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

const scene = BUNDLED_SCENES[0]; // rush-hour
const options = scene.options;

const app = document.querySelector<HTMLElement>("#app")!;
const controls = document.createElement("div");
app.append(controls);
const renderer = mountRenderer(app, { background: scene.baseArt.background, swatches: true });

let choices: Choices = {};
const slider = Object.assign(document.createElement("input"), { type: "range", min: "0", max: "1", step: "0.01" });

const apply = (opacity?: number) => {
  const t = resolveTarget(options, choices);
  if (opacity === undefined) slider.value = String(t.washOpacity);
  else t.washOpacity = opacity;
  renderer.setTarget(t);
};

for (const o of options.palette) {
  const b = Object.assign(document.createElement("button"), { textContent: o.label });
  b.onclick = () => {
    choices = { ...choices, palette: { optionId: o.id, uid: "dev", at: 0 } };
    apply();
  };
  controls.append(b);
}
slider.oninput = () => apply(Number(slider.value));
controls.append(" washOpacity ", slider);
apply();
