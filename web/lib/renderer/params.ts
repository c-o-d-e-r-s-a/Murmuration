// Target vs. current (ARCHITECTURE §6): choices -> target RenderParams; each frame eases current toward target.
import { EASE_NUMERIC_MS, EASE_PALETTE_MS, ROLES } from "../../../shared/contracts";
import type { Choices, RenderParams, Scene } from "../../../shared/contracts";
import { presetParams } from "../../../shared/presets";

/** What the renderer draws: RenderParams with colors as [r, g, b] 0..255 so they can be lerped. */
export type Current = Omit<RenderParams, "colors"> & { colors: [number, number, number][] };

/** Unfilled roles and unknown option ids resolve to the role's neutral preset. */
export function resolveTarget(options: Scene["options"] | undefined, choices: Choices | undefined): RenderParams {
  const out = {} as RenderParams;
  for (const role of ROLES) {
    const id = choices?.[role]?.optionId;
    const opt = id ? options?.[role]?.find((o) => o.id === id) : undefined;
    Object.assign(out, presetParams(role, opt?.presetId, opt?.overrides));
  }
  return out;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Current snapped to target (first frame, or a refreshed screen: no catch-up animation). */
export function toCurrent(t: RenderParams): Current {
  return { ...t, colors: t.colors.map(rgb) };
}

/** Exponential ease, frame-rate independent: current += (target - current) * (1 - exp(-dt / tau)). Mutates cur. */
export function ease(cur: Current, target: RenderParams, dtMs: number): void {
  const kNum = 1 - Math.exp(-dtMs / EASE_NUMERIC_MS);
  const kPal = 1 - Math.exp(-dtMs / EASE_PALETTE_MS);
  // ponytail: sRGB lerp, not a perceptual space; upgrade to OKLab if mid-fades look muddy.
  for (let i = 0; i < 4; i++) {
    const n = parseInt(target.colors[i].slice(1), 16);
    const c = cur.colors[i];
    c[0] += (((n >> 16) & 255) - c[0]) * kPal;
    c[1] += (((n >> 8) & 255) - c[1]) * kPal;
    c[2] += ((n & 255) - c[2]) * kPal;
  }
  for (const k in target) {
    if (k === "colors") continue;
    const v = target[k];
    // Enums and the mood word snap here; live.ts crossfades particle/motion kinds with per-kind weights.
    if (typeof v === "number") cur[k] += (v - cur[k]) * kNum;
    else cur[k] = v;
  }
}
