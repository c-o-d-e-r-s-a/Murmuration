// p5 sketch shared by /screen and /dev: wash, motion light, base art, particles, mood watermark, grain, vignette.
import p5 from "p5";
import { CANVAS_MAX_W, PARTICLE_CAP, PIXEL_DENSITY_CAP } from "../../../shared/contracts";
import type { RenderParams, Scene, Shape } from "../../../shared/contracts";
import { toCurrent } from "./params";
import type { Current } from "./params";
import { createLive, mulberry32, REF_H, REF_W, stepLive, stepsAt } from "./live";
import type { Live } from "./live";

// clock: ms since round start (D-20); defaults to ms since mount. seed: round.seed.
type Opts = { background: string; swatches?: boolean; baseArt?: Scene["baseArt"]; seed?: number; clock?: () => number; adaptive?: boolean };

const GRAIN_TILE = 128;
const rgba = ([r, g, b]: number[], a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

export function mountRenderer(parent: HTMLElement, opts: Opts) {
  let target: RenderParams | null = null;
  let cur: Current | null = null;
  let live: Live | null = null;
  let art: p5.Graphics | null = null; // base art, drawn once per size (not per frame)
  let grain: CanvasPattern | null = null;
  const sprite = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }); // soft particle, tinted per frame
  const seed = opts.seed ?? 1;
  // A5: smoothed frame time drives how many of the (always simulated) particles are drawn, so the sim stays deterministic.
  const stats = { fps: 60, scale: 1, drawn: 0 };
  let ms = 1000 / 60;

  // D-16: scene paths -> Path2D on an offscreen layer; viewBox scaled uniformly and centered, so resizing keeps the composition.
  const drawArt = (s: p5, shapes: Shape[], vb: number[]) => {
    art?.remove();
    art = s.createGraphics(s.width, s.height);
    const ctx = art.drawingContext as CanvasRenderingContext2D;
    const k = Math.min(s.width / vb[2], s.height / vb[3]);
    ctx.scale(k, k); // p5.Graphics already applies its pixelDensity scale
    ctx.translate((s.width / k - vb[2]) / 2 - vb[0], (s.height / k - vb[3]) / 2 - vb[1]);
    for (const sh of shapes) {
      const p = new Path2D(sh.d);
      if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fill(p); }
      if (sh.stroke) { ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.strokeWidth ?? 1; ctx.stroke(p); }
    }
  };

  // Seeded gray noise tile; offset per 5 steps (12 Hz) so grain moves without any area-wide luminance change.
  const makeGrain = (ctx: CanvasRenderingContext2D) => {
    const c = Object.assign(document.createElement("canvas"), { width: GRAIN_TILE, height: GRAIN_TILE });
    const g = c.getContext("2d")!;
    const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rand = mulberry32(seed ^ 0x9e3779b9);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = rand() * 256;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grain = ctx.createPattern(c, "repeat");
  };

  const fit = (): [number, number] => {
    const w = Math.min(parent.clientWidth, CANVAS_MAX_W, (window.innerHeight * 16) / 9);
    return [w, (w * 9) / 16];
  };

  new p5((s: p5) => {
    const clock = opts.clock ?? (() => s.millis());
    s.setup = () => {
      s.pixelDensity(Math.min(window.devicePixelRatio, PIXEL_DENSITY_CAP));
      s.createCanvas(...fit()).parent(parent);
      s.noStroke();
      makeGrain(s.drawingContext as CanvasRenderingContext2D);
      if (opts.baseArt) drawArt(s, opts.baseArt.shapes, opts.baseArt.viewBox);
    };
    s.windowResized = () => {
      s.resizeCanvas(...fit());
      if (opts.baseArt) drawArt(s, opts.baseArt.shapes, opts.baseArt.viewBox);
    };
    s.draw = () => {
      if (s.deltaTime > 0 && s.deltaTime < 500) { // ignore hidden-tab gaps
        ms += (s.deltaTime - ms) * 0.05;
        stats.fps = 1000 / ms;
        // ponytail: simple AIMD on draw count (floor 15%); upgrade path = also shed grain/vignette.
        if (opts.adaptive) stats.scale = ms > 20 ? Math.max(0.15, stats.scale * 0.97) : ms < 17.5 ? Math.min(1, stats.scale + 0.002) : stats.scale;
      }
      s.background(opts.background);
      if (!target) return;
      live ??= createLive(seed, cur);
      // ponytail: catch-up after a long gap (refresh mid-round, hidden tab) runs every missed step in one frame; ~5k steps max per round.
      const due = stepsAt(clock());
      while (live.steps < due) stepLive(live, cur, target);

      const ctx = s.drawingContext as CanvasRenderingContext2D;
      const W = s.width, H = s.height, k = W / REF_W;
      // Wash = vertical gradient bg -> primary -> secondary. colors[0] alone is near-black and looked like no change.
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      cur.colors.slice(0, 3).forEach((c, i) => grad.addColorStop(i / 2, rgba(c, 1)));
      ctx.globalAlpha = cur.washOpacity;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      // Motion light: accent glow behind the skyline; area capped by FLICKER_MAX_AREA in live.ts.
      if (live.ga > 0.005 && live.gr > 1) {
        const g = ctx.createRadialGradient(live.gx * k, live.gy * k, 0, live.gx * k, live.gy * k, live.gr * k);
        g.addColorStop(0, rgba(cur.colors[3], Math.min(live.ga, 1)));
        g.addColorStop(1, rgba(cur.colors[3], 0));
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }

      if (art) s.image(art, 0, 0, W, H);

      // Particles: soft kinds (fog, steam) are tinted sprites at low alpha; sharp kinds (sparks, dust) are small squares.
      const n = Math.floor(cur.particleDensity * PARTICLE_CAP * stats.scale);
      stats.drawn = n;
      const { fog, steam, sparks, dust } = live.pw;
      if (fog + steam > 0.01) {
        const sg = sprite.getContext("2d")!;
        const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, rgba(cur.colors[1], 1));
        rg.addColorStop(1, rgba(cur.colors[1], 0));
        sg.clearRect(0, 0, 64, 64);
        sg.fillStyle = rg;
        sg.fillRect(0, 0, 64, 64);
        for (let i = 0; i < n; i++) {
          const r = cur.particleSize * live.s[i] * k, y = live.y[i];
          ctx.globalAlpha = 0.08 * fog + 0.14 * steam * Math.max(0, Math.min(1, y / REF_H)); // steam thins as it rises
          ctx.drawImage(sprite, live.x[i] * k - r, y * k - r, 2 * r, 2 * r);
        }
      }
      for (const [w, color, alpha] of [[sparks, cur.colors[3], 0.9], [dust, cur.colors[1], 0.5]] as const) {
        if (w < 0.01) continue;
        ctx.globalAlpha = alpha * w;
        ctx.fillStyle = rgba(color, 1);
        for (let i = 0; i < n; i++) {
          const d = Math.max(1, cur.particleSize * live.s[i] * k);
          ctx.fillRect(live.x[i] * k, live.y[i] * k, d, d);
        }
      }
      ctx.globalAlpha = 1;

      // Mood watermark (art direction §9): Display 800, ~40% width, lower third, faint, screen-blended on dark washes.
      if (cur.moodWord) {
        ctx.font = `800 100px "Bricolage Grotesque", "Arial Black", sans-serif`;
        const size = (100 * 0.4 * W) / ctx.measureText(cur.moodWord).width;
        ctx.font = `800 ${size}px "Bricolage Grotesque", "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.08;
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "#F4EFE6";
        ctx.fillText(cur.moodWord, W / 2, H * 0.78);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      if (grain && cur.grainAmount > 0) {
        const f = Math.floor(live.steps / 5), ox = (f * 97) % GRAIN_TILE, oy = (f * 61) % GRAIN_TILE;
        const gs = Math.max(1, cur.grainScale * k);
        ctx.save();
        ctx.globalAlpha = cur.grainAmount;
        ctx.globalCompositeOperation = "overlay";
        ctx.scale(gs, gs);
        ctx.translate(-ox, -oy);
        ctx.fillStyle = grain;
        ctx.fillRect(ox, oy, W / gs, H / gs);
        ctx.restore();
      }

      if (cur.vignette > 0) {
        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, "rgba(0,0,0,1)");
        ctx.globalAlpha = cur.vignette;
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (opts.swatches) {
        const w = W / 4;
        cur.colors.forEach(([r, g, b], i) => {
          s.fill(r, g, b);
          s.rect(i * w, H * 0.9, w, H * 0.1);
        });
      }
    };
  });

  return {
    stats,
    setTarget(t: RenderParams) {
      if (!cur) cur = toCurrent(t);
      target = t;
    },
  };
}
