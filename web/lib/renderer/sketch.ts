// p5 sketch shared by /screen and /dev. A2 draws the color wash only; base art, particles, grain, etc. come later.
import p5 from "p5";
import { CANVAS_MAX_W, PIXEL_DENSITY_CAP } from "../../../shared/contracts";
import type { RenderParams } from "../../../shared/contracts";
import { ease, toCurrent } from "./params";
import type { Current } from "./params";

type Opts = { background: string; swatches?: boolean };

export function mountRenderer(parent: HTMLElement, opts: Opts) {
  let target: RenderParams | null = null;
  let cur: Current | null = null;

  const fit = (): [number, number] => {
    const w = Math.min(parent.clientWidth, CANVAS_MAX_W, (window.innerHeight * 16) / 9);
    return [w, (w * 9) / 16];
  };

  new p5((s: p5) => {
    s.setup = () => {
      s.pixelDensity(Math.min(window.devicePixelRatio, PIXEL_DENSITY_CAP));
      s.createCanvas(...fit()).parent(parent);
      s.noStroke();
    };
    s.windowResized = () => s.resizeCanvas(...fit());
    s.draw = () => {
      s.background(opts.background);
      if (!target) return;
      ease(cur, target, s.deltaTime);
      // Wash = vertical gradient bg -> primary -> secondary. colors[0] alone is near-black and looked like no change.
      const ctx = s.drawingContext as CanvasRenderingContext2D;
      const grad = ctx.createLinearGradient(0, 0, 0, s.height);
      cur.colors.slice(0, 3).forEach(([r, g, b], i) => grad.addColorStop(i / 2, `rgb(${r | 0},${g | 0},${b | 0})`));
      ctx.globalAlpha = cur.washOpacity;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s.width, s.height);
      ctx.globalAlpha = 1;
      if (opts.swatches) {
        const w = s.width / 4;
        cur.colors.forEach(([r, g, b], i) => {
          s.fill(r, g, b);
          s.rect(i * w, s.height * 0.9, w, s.height * 0.1);
        });
      }
    };
  });

  return {
    setTarget(t: RenderParams) {
      if (!cur) cur = toCurrent(t);
      target = t;
    },
  };
}
