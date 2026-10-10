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
      const [r, g, b] = cur.colors[0];
      s.fill(r, g, b, cur.washOpacity * 255);
      s.rect(0, 0, s.width, s.height);
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
