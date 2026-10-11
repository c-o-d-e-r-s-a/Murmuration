// Scene loader: validates raw scene JSON (DATA_SCHEMA §5). Returns a valid Scene or throws a clear error.
import { AUTHOR_RANK_SCORES, OPTIONS_PER_ROLE, OPTION_ID_MAX, OPTION_LABEL_MAX, PROMPT_TEXT_MAX, ROLES } from "./contracts";
import type { Option, Scene } from "./contracts";
import { PRESETS, stripProtected } from "./presets";
import rushHour from "./scenes/rush-hour.json";
import diner from "./scenes/diner.json";
import vigilante from "./scenes/vigilante.json";

export function loadScene(raw: unknown): Scene {
  const scene = structuredClone(raw) as Scene;
  const id = scene?.id;
  const fail = (msg: string): never => {
    throw new Error(`scene "${id}": ${msg}`);
  };
  if (!id || !scene.title || !scene.description || !scene.options || !scene.baseArt) fail("missing id, title, description, options or baseArt");
  if (scene.kind !== "demo" && scene.kind !== "custom") fail(`bad kind "${scene.kind}"`);

  const custom = scene.kind === "custom";
  const seenIds = new Set<string>();
  for (const role of ROLES) {
    const opts: Option[] = scene.options[role] ?? [];
    if (opts.length !== OPTIONS_PER_ROLE) fail(`${role} has ${opts.length} options, need ${OPTIONS_PER_ROLE}`);
    const scores = new Set<number>();
    for (const o of opts) {
      if (!o.id || o.id.length > OPTION_ID_MAX) fail(`${role} option id "${o.id}" empty or > ${OPTION_ID_MAX}`);
      if (seenIds.has(o.id)) fail(`duplicate option id "${o.id}"`);
      seenIds.add(o.id);
      if (PRESETS[o.presetId]?.role !== role) fail(`${role} option "${o.id}" has unknown or wrong-role presetId "${o.presetId}"`);
      if (!o.label || o.label.length > OPTION_LABEL_MAX) fail(`${role} option "${o.id}" label empty or > ${OPTION_LABEL_MAX}`);
      if (!AUTHOR_RANK_SCORES.includes(o.authorScore)) fail(`${role} option "${o.id}" authorScore ${o.authorScore} not in ${AUTHOR_RANK_SCORES}`);
      if (scores.has(o.authorScore)) fail(`${role} has duplicate authorScore ${o.authorScore}`);
      scores.add(o.authorScore);
      if (custom) delete o.overrides;
      else if (o.overrides) o.overrides = stripProtected(o.overrides) as Option["overrides"];
    }
  }
  for (const p of scene.prompts ?? []) {
    if (!p.text || p.text.length > PROMPT_TEXT_MAX) fail(`prompt "${p.id}" empty or > ${PROMPT_TEXT_MAX} chars`);
  }
  if (custom) for (const s of scene.baseArt.shapes) delete s.hotspot;
  return scene;
}

/** Bundled scenes for the host picker. */
export const BUNDLED_SCENES: Scene[] = [loadScene(vigilante), loadScene(diner), loadScene(rushHour)];
