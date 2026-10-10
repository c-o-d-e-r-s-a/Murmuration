import type { Choices, Role } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

const scene = BUNDLED_SCENES[0]; // rush-hour
const options = scene.options;
const ROLES: Role[] = ["palette", "form", "motion"]; // solo plan: texture/mood stay neutral

// ?seed=N&t=MS freezes the clock at t (determinism check); ?palette=ID&form=ID&motion=ID preselects options.
const q = new URLSearchParams(location.search);
const seed = Number(q.get("seed") ?? 1);
const frozenT = q.has("t") ? Number(q.get("t")) : null;

const app = document.querySelector<HTMLElement>("#app")!;
const controls = document.createElement("div");
const info = document.createElement("div");
app.append(controls, info);
const renderer = mountRenderer(app, {
  background: scene.baseArt.background,
  baseArt: scene.baseArt,
  swatches: true,
  seed,
  adaptive: frozenT === null && q.get("adaptive") !== "0", // ?adaptive=0 to measure raw fps
  clock: frozenT === null ? undefined : () => frozenT,
});

let choices: Choices = {};
for (const r of ROLES) if (q.get(r)) choices[r] = { optionId: q.get(r), uid: "dev", at: 0 };
const slider = Object.assign(document.createElement("input"), { type: "range", min: "0", max: "1", step: "0.01" });

const apply = (opacity?: number) => {
  const t = resolveTarget(options, choices);
  if (opacity === undefined) slider.value = String(t.washOpacity);
  else t.washOpacity = opacity;
  renderer.setTarget(t);
};

for (const r of ROLES) {
  const row = document.createElement("div");
  row.append(`${r} `);
  for (const o of options[r]) {
    const b = Object.assign(document.createElement("button"), { textContent: o.label });
    b.onclick = () => {
      choices = { ...choices, [r]: { optionId: o.id, uid: "dev", at: 0 } };
      apply();
    };
    row.append(b);
  }
  controls.append(row);
}
slider.oninput = () => apply(Number(slider.value));
controls.append(" washOpacity ", slider);
apply();

const { stats } = renderer;
const fpsEl = document.createElement("div");
app.append(fpsEl);
setInterval(() => {
  fpsEl.textContent = `${stats.fps.toFixed(0)} fps · ${stats.drawn} particles drawn (${(stats.scale * 100).toFixed(0)}%) · ${app.querySelector("canvas")!.width}×${app.querySelector("canvas")!.height}px`;
}, 500);

if (frozenT !== null) {
  setTimeout(() => {
    const d = app.querySelector("canvas")!.toDataURL();
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d.charCodeAt(i)) | 0;
    info.textContent = `seed ${seed} · t ${frozenT} ms · pixel hash ${(h >>> 0).toString(16)}`;
  }, 1500);
}
