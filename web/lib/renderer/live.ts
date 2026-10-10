// Live layer state (D-20): a pure function of (seed, target history, fixed-step time). No p5/DOM, so it is node-testable.
// Fixed 1/60 s steps make the frame at time t independent of the display's frame timing.
import { EASE_NUMERIC_MS, FLICKER_MAX_AREA, FLICKER_MAX_HZ, PARTICLE_CAP } from "../../../shared/contracts";
import type { RenderParams } from "../../../shared/contracts";
import { ease } from "./params";
import type { Current } from "./params";

export const STEP_MS = 1000 / 60;
/** Steps due at t ms; integer math so t = 30000 is exactly 1800 steps. */
export const stepsAt = (tMs: number) => Math.floor((tMs * 60) / 1000 + 1e-6);
export const REF_W = 1920; // simulation space = 1080p reference; the sketch scales to the canvas
export const REF_H = 1080;

export const mulberry32 = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Live = ReturnType<typeof createLive>;

export function createLive(seed: number, cur: Current) {
  const rand = mulberry32(seed);
  const arr = (f: () => number) => Float32Array.from({ length: PARTICLE_CAP }, f);
  const weights = (kinds: string[], on: string) => Object.fromEntries(kinds.map((k) => [k, k === on ? 1 : 0]));
  return {
    steps: 0,
    x: arr(() => rand() * REF_W),
    y: arr(() => rand() * REF_H),
    a: arr(() => rand() * Math.PI * 2), // heading
    s: arr(() => 0.5 + rand()), // speed / size factor
    p: arr(() => rand() * Math.PI * 2), // drift phase
    f: arr(() => 0.1 + rand() * 0.4), // drift Hz
    // Enums crossfade through per-kind weights, so rapid switches never pop.
    pw: weights(["fog", "steam", "sparks", "dust"], cur.particleKind),
    mw: weights(["pulse", "sway", "flicker", "drift"], cur.motionKind),
    phase: 0, // motion phase (rad), integrated so an easing rate never jumps
    anchorX: REF_W * (0.25 + rand() * 0.5), // no hotspots in the solo plan: motion drives one light in the sky
    anchorY: REF_H * (0.25 + rand() * 0.2),
    gx: 0, gy: 0, gr: 0, ga: 0, // glow out: center, radius (ref px), alpha
  };
}

/** One fixed step: ease params, crossfade kinds, move particles, update the motion light. Mutates L and cur. */
export function stepLive(L: Live, cur: Current, target: RenderParams): void {
  ease(cur, target, STEP_MS);
  const dt = STEP_MS / 1000;
  const t = L.steps * dt;
  const k = 1 - Math.exp(-STEP_MS / EASE_NUMERIC_MS);
  for (const kind in L.pw) L.pw[kind] += ((kind === cur.particleKind ? 1 : 0) - L.pw[kind]) * k;
  for (const kind in L.mw) L.mw[kind] += ((kind === cur.motionKind ? 1 : 0) - L.mw[kind]) * k;

  // fog slides sideways, steam rises, sparks shoot up, dust wanders; mixed by weight during a crossfade
  const { fog, steam, sparks, dust } = L.pw;
  const sp = cur.particleSpeed, dr = cur.particleDrift * sp, m = cur.particleSize * 1.5;
  for (let i = 0; i < PARTICLE_CAP; i++) {
    const s = L.s[i] * sp, ca = Math.cos(L.a[i]), sa = Math.sin(L.a[i]);
    const w = 2 * Math.PI * L.f[i] * t + L.p[i];
    const vx = fog * s + steam * 0.2 * s * ca + sparks * 0.5 * s * ca + dust * s * ca + dr * Math.sin(w);
    const vy = fog * 0.1 * s * sa - steam * s - sparks * s * (0.5 + 0.5 * Math.abs(sa)) + dust * s * sa + 0.5 * dr * Math.cos(0.7 * w);
    let x = L.x[i] + vx * dt, y = L.y[i] + vy * dt;
    if (x < -m) x += REF_W + 2 * m; else if (x > REF_W + m) x -= REF_W + 2 * m;
    if (y < -m) y += REF_H + 2 * m; else if (y > REF_H + m) y -= REF_H + 2 * m;
    L.x[i] = x;
    L.y[i] = y;
  }

  // Photosensitivity caps re-applied here so no target (even a /dev slider) can exceed them.
  L.phase += 2 * Math.PI * Math.min(cur.motionRateHz, FLICKER_MAX_HZ) * dt;
  const ph = L.phase, mw = L.mw;
  L.gr = Math.sqrt((Math.min(cur.motionArea, FLICKER_MAX_AREA) * REF_W * REF_H) / Math.PI);
  L.ga = cur.motionAmplitude * (mw.pulse * (0.5 + 0.5 * Math.sin(ph)) + mw.flicker * (Math.sin(ph) > 0 ? 1 : 0.3) + 0.7 * (mw.sway + mw.drift));
  L.gx = L.anchorX + L.gr * (0.5 * mw.sway * Math.sin(ph) + 0.8 * mw.drift * Math.sin(ph));
  L.gy = L.anchorY + L.gr * 0.3 * mw.drift * Math.sin(0.5 * ph);
  L.steps++;
}
