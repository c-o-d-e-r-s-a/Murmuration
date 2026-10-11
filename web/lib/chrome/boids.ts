// Brand flock v2 (art direction §12.2): a boid flock. Hundreds of birds, no leader; separation, alignment and cohesion make the
// shape. Each bird is a 2-point dash oriented along its velocity that collapses to a dot at rest, so a settled flock *is* the dot
// motif. Chrome only (/, /play, /demo); never over live artwork. /screen keeps flock.ts and does not import this file.
// Budget: DPR ≤ 1.5, no per-frame allocation, pauses when hidden or off-screen; reduced motion renders one settled frame.
import { mulberry32 } from "../renderer/live";

export type Region = { x: number; y: number; w: number; h: number }; // fractions of the canvas
export type Target = { x: number; y: number; r?: number }; // 0..100 box, mapped into a Region
export type BoidMode =
  | { kind: "roam"; home?: Region }
  | { kind: "groups"; homes: Region[]; tints?: string[] }
  | { kind: "settle"; targets: Target[]; box: Region; tint?: string };

type Opts = { count?: number; seed?: number; color?: string; alpha?: number; pointer?: boolean; mode?: BoidMode };

const FULL: Region = { x: 0.05, y: 0.08, w: 0.9, h: 0.84 };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountBoids(canvas: HTMLCanvasElement, opts: Opts = {}) {
  const n = opts.count ?? 160;
  const rand = mulberry32(opts.seed ?? 7);
  const color = opts.color ?? "#f4efe6";
  const alpha = opts.alpha ?? 0.34;
  const px = new Float32Array(n), py = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
  const ax = new Float32Array(n), ay = new Float32Array(n);
  const sz = Float32Array.from({ length: n }, () => 0.7 + rand() * 0.6); // per-bird size
  const ph = Float32Array.from({ length: n }, () => rand() * Math.PI * 2); // wander phase
  const jx = Float32Array.from({ length: n }, () => rand() * 2 - 1), jy = Float32Array.from({ length: n }, () => rand() * 2 - 1);
  const group = new Uint8Array(n);
  const tx = new Float32Array(n), ty = new Float32Array(n); // settle targets (canvas px)
  const ctx = canvas.getContext("2d")!;
  let w = 0, h = 0, unit = 1, dpr = 1;
  let mode: BoidMode = opts.mode ?? { kind: "roam" };
  let tints: string[] = [color];
  let pointerX = -1e9, pointerY = -1e9;
  let visible = true, inView = true, dead = false;
  let seeded = false;

  const regionPx = (r: Region) => ({ cx: (r.x + r.w / 2) * w, cy: (r.y + r.h / 2) * h, rx: (r.w * w) / 2, ry: (r.h * h) / 2 });
  const homeOf = (i: number): Region => (mode.kind === "groups" ? mode.homes[group[i]] : mode.kind === "roam" ? (mode.home ?? FULL) : FULL);

  function layout() {
    if (!w || !h) return;
    if (mode.kind === "settle") {
      const { targets, box } = mode;
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const spread = (t.r ?? 2) * 0.9;
        tx[i] = (box.x + (box.w * (t.x + jx[i] * spread)) / 100) * w;
        ty[i] = (box.y + (box.h * (t.y + jy[i] * spread)) / 100) * h;
        group[i] = 0;
      }
      tints = [mode.tint ?? color];
    } else if (mode.kind === "groups") {
      for (let i = 0; i < n; i++) group[i] = i % mode.homes.length;
      tints = mode.tints ?? mode.homes.map(() => color);
    } else {
      group.fill(0);
      tints = [color];
    }
    if (!seeded) {
      seeded = true;
      // Birth: on or near the first mode's shape, so a settle mode shows the mark from frame one.
      for (let i = 0; i < n; i++) {
        if (mode.kind === "settle") { px[i] = tx[i] + jx[i] * 6; py[i] = ty[i] + jy[i] * 6; }
        else {
          const r = regionPx(homeOf(i));
          px[i] = r.cx + jx[i] * r.rx * 0.8; py[i] = r.cy + jy[i] * r.ry * 0.8;
        }
        const a = rand() * Math.PI * 2, s = 30 + rand() * 40;
        vx[i] = Math.cos(a) * s; vy[i] = Math.sin(a) * s;
      }
    }
  }

  function step(dt: number, t: number) {
    const maxS = 120 * unit, minS = 36 * unit;
    const sepR = 16 * unit, aliR = 46 * unit, cohR = 72 * unit;
    const sep2 = sepR * sepR, ali2 = aliR * aliR, coh2 = cohR * cohR;
    const settle = mode.kind === "settle";
    ax.fill(0); ay.fill(0);
    // Pairwise rules; symmetric accumulation halves the work.
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, avx = 0, avy = 0, cx = 0, cy = 0, na = 0, nc = 0;
      for (let j = 0; j < n; j++) {
        if (j === i || group[j] !== group[i]) continue;
        const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
        if (d2 < sep2 && d2 > 0.01) { const inv = 1 / d2; sx -= dx * inv; sy -= dy * inv; }
        if (!settle) {
          if (d2 < ali2) { avx += vx[j]; avy += vy[j]; na++; }
          if (d2 < coh2) { cx += dx; cy += dy; nc++; }
        }
      }
      ax[i] += sx * 900 * unit; ay[i] += sy * 900 * unit;
      if (na) { ax[i] += (avx / na - vx[i]) * 1.2; ay[i] += (avy / na - vy[i]) * 1.2; }
      if (nc) { ax[i] += (cx / nc) * 0.9; ay[i] += (cy / nc) * 0.9; }
      // Wander: a slow sideways waver so a calm flock still breathes (≤ 0.5 Hz per bird).
      const sp = Math.hypot(vx[i], vy[i]) || 1;
      const wob = Math.sin(t * (1.6 + sz[i]) + ph[i]) * (settle ? 4 : 28) * unit;
      ax[i] += (-vy[i] / sp) * wob; ay[i] += (vx[i] / sp) * wob;
      // Pointer: the flock bends away from a predator.
      const pdx = px[i] - pointerX, pdy = py[i] - pointerY, pd2 = pdx * pdx + pdy * pdy, pr = 150 * unit;
      if (pd2 < pr * pr && pd2 > 1) { const f = (1 - Math.sqrt(pd2) / pr) * 1400 * unit / Math.sqrt(pd2); ax[i] += pdx * f; ay[i] += pdy * f; }
      if (settle) {
        // Arrive: steer to the target, braking inside 40 px; at rest the dash becomes a dot.
        const dx = tx[i] - px[i], dy = ty[i] - py[i], d = Math.hypot(dx, dy);
        const want = Math.min(maxS, d * 4);
        const dvx = d > 0.5 ? (dx / d) * want : 0, dvy = d > 0.5 ? (dy / d) * want : 0;
        ax[i] += (dvx - vx[i]) * 6; ay[i] += (dvy - vy[i]) * 6;
      } else {
        // Soft home: inside the ellipse nothing; outside, a pull proportional to the overshoot.
        const r = regionPx(homeOf(i));
        const ex = (px[i] - r.cx) / r.rx, ey = (py[i] - r.cy) / r.ry, e = Math.hypot(ex, ey);
        if (e > 1) { const k = (e - 1) * 220 * unit; ax[i] -= (ex / e) * k; ay[i] -= (ey / e) * k; }
      }
    }
    for (let i = 0; i < n; i++) {
      vx[i] += ax[i] * dt; vy[i] += ay[i] * dt;
      const s = Math.hypot(vx[i], vy[i]);
      if (s > maxS) { vx[i] *= maxS / s; vy[i] *= maxS / s; }
      else if (!settle && s < minS && s > 0) { vx[i] *= minS / s; vy[i] *= minS / s; }
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.globalAlpha = alpha;
    const maxS = 120 * unit;
    for (let g = 0; g < tints.length; g++) {
      ctx.strokeStyle = tints[g];
      ctx.lineWidth = 2.2 * unit;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (group[i] !== g) continue;
        const s = Math.hypot(vx[i], vy[i]);
        const len = Math.max(0.2, (s / maxS) * 7 * unit * sz[i]);
        const ux = s ? vx[i] / s : 1, uy = s ? vy[i] / s : 0;
        ctx.moveTo(px[i] - ux * len, py[i] - uy * len);
        ctx.lineTo(px[i] + ux * len * 0.4, py[i] + uy * len * 0.4);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function stillFrame() {
    for (let k = 0; k < 420; k++) step(1 / 60, k / 60);
    draw();
  }

  const ro = new ResizeObserver(() => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    const first = !w;
    w = cw; h = ch;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    unit = Math.max(0.75, Math.min(w, h) / 720);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first) layout(); else if (mode.kind === "settle") layout();
    if (REDUCED) stillFrame(); else draw();
  });
  ro.observe(canvas);

  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { visible = document.visibilityState === "visible"; };
  document.addEventListener("visibilitychange", onVis);
  const onMove = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    pointerX = e.clientX - b.left; pointerY = e.clientY - b.top;
  };
  const onLeave = () => { pointerX = pointerY = -1e9; };
  if (opts.pointer) { addEventListener("pointermove", onMove, { passive: true }); addEventListener("pointerleave", onLeave); addEventListener("blur", onLeave); }

  let last = 0;
  const loop = (now: number) => {
    if (dead) return;
    requestAnimationFrame(loop);
    if (!w || !visible || !inView) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    step(dt, now / 1000);
    draw();
  };
  if (!REDUCED) requestAnimationFrame(loop);

  return {
    setMode(m: BoidMode) {
      mode = m;
      layout();
      if (REDUCED && w) stillFrame();
    },
    destroy() {
      dead = true;
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("pointermove", onMove); removeEventListener("pointerleave", onLeave); removeEventListener("blur", onLeave);
    },
  };
}
