// Brand flock (art direction §8): 40–80 dots, --text-primary at 20–35% opacity, drifting as one loose cluster.
// Chrome only: never mount it over the live artwork. Positions are a pure function of time, so reduced motion is t = 0.
import { mulberry32 } from "../renderer/live";

const TAU = Math.PI * 2;

/** Every rate below is ≤ 0.1 Hz (§5.3 rule 2: no chrome oscillation above 1 Hz). `active` false = skip drawing (frame holds). */
export function mountFlock(canvas: HTMLCanvasElement, { seed = 1, count = 60, active = (): boolean => true } = {}) {
  const rand = mulberry32(seed);
  const soft = () => (rand() + rand() + rand()) / 3 - 0.5; // clustered toward the middle, not uniform
  const dots = Array.from({ length: count }, () => ({
    x: soft(), y: soft() * 0.6, r: 1 + rand(), a: 0.2 + rand() * 0.15, p: rand() * TAU, f: 0.03 + rand() * 0.05,
  }));
  const ctx = canvas.getContext("2d")!;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, unit = 1;

  function draw(t: number) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4efe6";
    const cx = w * (0.5 + 0.18 * Math.sin(TAU * 0.011 * t));
    const cy = h * (0.5 + 0.14 * Math.sin(TAU * 0.017 * t + 1));
    const span = Math.min(w, h * 1.6) * 0.9;
    for (const d of dots) {
      const lag = (d.x + d.y) * 3; // the stretch travels through the cluster like a murmuration wave
      const sx = 1 + 0.35 * Math.sin(TAU * 0.05 * t - lag);
      const sy = 1 + 0.25 * Math.cos(TAU * 0.04 * t - lag);
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(cx + span * (d.x * sx + 0.02 * Math.sin(TAU * d.f * t + d.p)), cy + span * (d.y * sy + 0.02 * Math.cos(TAU * d.f * t + d.p)), d.r * unit, 0, TAU);
      ctx.fill();
    }
  }

  new ResizeObserver(() => {
    const dpr = Math.min(devicePixelRatio, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    unit = Math.max(1, innerHeight / 1080); // 2–4 px dots at 1080p
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still && w) draw(0);
  }).observe(canvas);

  if (still) return;
  const t0 = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (w && active()) draw((now - t0) / 1000);
  };
  requestAnimationFrame(loop);
}
