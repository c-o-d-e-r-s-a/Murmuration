import { ROLES } from "../../shared/contracts";
import type { Choices, Scene } from "../../shared/contracts";
import { PRESETS } from "../../shared/presets";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

// Mock scene options until shared/scenes + sceneLoader exist: one option per preset, id = presetId.
const options = Object.fromEntries(
  ROLES.map((role) => [
    role,
    Object.values(PRESETS)
      .filter((x) => x.role === role)
      .map((x) => ({ id: x.id, presetId: x.id, label: x.label, authorScore: 10 as const })),
  ]),
) as Scene["options"];

const app = document.querySelector<HTMLElement>("#app")!;
const controls = document.createElement("div");
app.append(controls);
const renderer = mountRenderer(app, { background: "#777777", swatches: true });

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
