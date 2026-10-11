// The Turn (art direction §12.2): Murmuration's mark is a flock. 24 seeded dots fill a leaning teardrop, dense at the head,
// thinning into a tail, like a murmuration photographed mid-turn. Pure geometry from our own seed; no imported art.
// `markDots` feeds both the SVG (header, favicon) and the landing boids, which start gathered as the mark and take flight.
import { mulberry32 } from "../renderer/live";

export type MarkDot = { x: number; y: number; r: number }; // 0..100 box

const SEED = 0x4d75726d; // "Murm"

/** Spine: tail (lower left) sweeping up into the head (upper right). */
function spine(t: number): [number, number, number, number] {
  const p0 = [16, 88], p1 = [40, 80], p2 = [74, 36];
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const n = Math.hypot(dx, dy) || 1;
  return [x, y, -dy / n, dx / n]; // point + unit normal
}

export function markDots(count = 32): MarkDot[] {
  const rand = mulberry32(SEED);
  const out: MarkDot[] = [];
  // The head is a cluster of its own so the silhouette has one unmistakable mass; birds stay separate, not a blob.
  const head = Math.round(count * 0.5);
  for (let i = 0; i < head; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 20;
    out.push({ x: 72 + Math.cos(a) * d * 1.2, y: 38 + Math.sin(a) * d * 0.9, r: 1.9 + rand() * 1.8 * (1 - d / 22) });
  }
  for (let i = head; i < count; i++) {
    const t = Math.pow(rand(), 0.65); // bias toward the head
    const [x, y, nx, ny] = spine(t);
    const w = 1.5 + 12 * t; // tail is thin
    const off = (rand() * 2 - 1) * w;
    out.push({ x: x + nx * off, y: y + ny * off, r: 1.1 + 1.8 * t * (1 - Math.abs(off) / (w + 0.01)) + rand() * 0.5 });
  }
  return out;
}

/** Compact mark: 9 hand-placed birds on the same spine, sized to read at 16–48 px (header, favicon). */
export const COMPACT_DOTS: MarkDot[] = [
  { x: 72, y: 36, r: 9 }, { x: 60, y: 41, r: 7.5 }, { x: 70, y: 50, r: 6.5 }, { x: 83, y: 29, r: 5 }, { x: 58, y: 29, r: 4.5 },
  { x: 49, y: 58, r: 5 }, { x: 40, y: 67, r: 4.2 }, { x: 30, y: 77, r: 3.4 }, { x: 20, y: 86, r: 2.6 },
];

/** Inline SVG string. Below 80 px the compact geometry is used unless `compact` is set explicitly. */
export function markSvg({ size = 28, compact = size < 80, color = "currentColor", title = "Murmuration" } = {}): string {
  const dots = compact ? COMPACT_DOTS : markDots();
  const circles = dots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${d.r.toFixed(1)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="${color}" role="img" aria-label="${title}">${circles}</svg>`;
}

/** DOM node for headers. */
export function markEl(size = 28, cls = "mark"): HTMLElement {
  const span = document.createElement("span");
  span.className = cls;
  span.style.width = span.style.height = `${size}px`;
  span.innerHTML = markSvg({ size }); // static geometry from this module only
  return span;
}
