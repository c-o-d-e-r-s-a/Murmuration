// Preset library (D-17): the only place render params are defined. Source: docs/DATA_SCHEMA.md §5, CONTRACTS §6.
// Photosensitivity caps are enforced here (clamp on build, strip on override) and cannot be overridden.
import { FLICKER_MAX_AREA, FLICKER_MAX_HZ, PROTECTED_PARAMS } from "./contracts";
import type { Preset, RenderParams, Role } from "./contracts";

const p = (id: string, role: Role, label: string, params: Partial<RenderParams>): Preset => ({ id, role, label, params });

const PRESET_LIST: Preset[] = [
  // palette: [bg wash, primary, secondary, accent]; accent stays a small touch (art direction §9)
  p("pal-neutral", "palette", "Overcast", { colors: ["#2b2b2b", "#8a8a8a", "#5c5c5c", "#d0d0d0"], washOpacity: 0.5 }),
  p("pal-sodium", "palette", "Sodium Dusk", { colors: ["#2a1a12", "#e08a2e", "#7a3b1d", "#ffd27a"], washOpacity: 0.6 }),
  p("pal-neon", "palette", "Neon Rain", { colors: ["#0c1424", "#2fd0c8", "#3b4fa0", "#ff4f8b"], washOpacity: 0.65 }),
  p("pal-dawn", "palette", "Cold Dawn", { colors: ["#1c2430", "#9bb8cf", "#5a7390", "#f2e3c0"], washOpacity: 0.5 }),
  p("pal-bruise", "palette", "Bruise", { colors: ["#1a1020", "#7d4fa8", "#3c2459", "#e8c25a"], washOpacity: 0.7 }),

  // form: soft kinds (fog, steam) are big, slow, low density-per-px; sharp kinds (sparks, dust) are small and bright
  p("form-neutral", "form", "Sparse Dust", { particleKind: "dust", particleDensity: 0.15, particleSize: 3, particleSpeed: 12, particleDrift: 0.3 }),
  p("form-fog", "form", "Low Fog", { particleKind: "fog", particleDensity: 0.5, particleSize: 90, particleSpeed: 14, particleDrift: 0.7 }),
  p("form-steam", "form", "Steam Vents", { particleKind: "steam", particleDensity: 0.4, particleSize: 60, particleSpeed: 40, particleDrift: 0.5 }),
  p("form-sparks", "form", "Sparks", { particleKind: "sparks", particleDensity: 0.3, particleSize: 3, particleSpeed: 140, particleDrift: 0.2 }),
  p("form-dust", "form", "Thick Dust", { particleKind: "dust", particleDensity: 0.7, particleSize: 3, particleSpeed: 24, particleDrift: 0.5 }),

  // motion: rate/area are protected and clamped below
  p("motion-neutral", "motion", "Still", { motionKind: "still", motionRateHz: 0, motionAmplitude: 0, motionArea: 0 }),
  p("motion-pulse", "motion", "Slow Pulse", { motionKind: "pulse", motionRateHz: 0.5, motionAmplitude: 0.5, motionArea: 0.2 }),
  p("motion-sway", "motion", "Sway", { motionKind: "sway", motionRateHz: 0.3, motionAmplitude: 0.6, motionArea: 0.25 }),
  p("motion-flicker", "motion", "Neon Buzz", { motionKind: "flicker", motionRateHz: 2.5, motionAmplitude: 0.4, motionArea: 0.15 }),
  p("motion-drift", "motion", "Drift", { motionKind: "drift", motionRateHz: 0.2, motionAmplitude: 0.7, motionArea: 0.25 }),

  // texture and mood: neutral only in the solo plan (BUILD_ORDER §8)
  p("tex-neutral", "texture", "Light Grain", { grainAmount: 0.15, grainScale: 2, vignette: 0.25 }),
  p("mood-neutral", "mood", "Quiet", { moodWord: "", energy: 0.5 }),
];

// ponytail: clamp once at build time; a flicker rate or area can only ever be defined here.
const clamp = (params: Partial<RenderParams>): Partial<RenderParams> => ({
  ...params,
  ...(params.motionRateHz !== undefined && { motionRateHz: Math.min(params.motionRateHz, FLICKER_MAX_HZ) }),
  ...(params.motionArea !== undefined && { motionArea: Math.min(params.motionArea, FLICKER_MAX_AREA) }),
});

export const PRESETS: Record<string, Preset> = Object.fromEntries(
  PRESET_LIST.map((x) => [x.id, { ...x, params: clamp(x.params) }]),
);

export const NEUTRAL_PRESET_ID: Record<Role, string> = {
  palette: "pal-neutral",
  form: "form-neutral",
  motion: "motion-neutral",
  texture: "tex-neutral",
  mood: "mood-neutral",
};

/** Preset for this role, or the role's neutral preset if the id is unknown or belongs to another role. */
export function getPreset(role: Role, presetId?: string | null): Preset {
  const found = presetId ? PRESETS[presetId] : undefined;
  return found && found.role === role ? found : PRESETS[NEUTRAL_PRESET_ID[role]];
}

/** Drop override keys that scenes may never set (flicker rate, flicker area). Used by the scene loader. */
export function stripProtected<T extends Record<string, unknown>>(overrides: T | undefined): Partial<T> {
  const out: Record<string, unknown> = { ...overrides };
  for (const k of PROTECTED_PARAMS) delete out[k];
  return out as Partial<T>;
}

/** Params for one role's pick: preset params plus scene overrides, protected keys always stripped. */
export function presetParams(role: Role, presetId?: string | null, overrides?: Record<string, number | string>): Partial<RenderParams> {
  return { ...getPreset(role, presetId).params, ...(stripProtected(overrides) as Partial<RenderParams>) };
}
