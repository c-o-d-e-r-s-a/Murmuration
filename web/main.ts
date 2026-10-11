import "./lib/chrome/ui.css";
import type { Role } from "../shared/contracts";
import { BUNDLED_SCENES } from "../shared/sceneLoader";
import { mountBoids } from "./lib/chrome/boids";
import type { BoidMode } from "./lib/chrome/boids";
import { icon } from "./lib/chrome/icons";
import type { IconName } from "./lib/chrome/icons";
import { markDots, markSvg } from "./lib/chrome/mark";

// Landing (art direction §12). The flock starts gathered as the mark, takes flight, and reorganises as you scroll:
// hero = one flock on the right; 01 = three tinted groups over the three dials; 03 = settles back into the mark.
document.querySelector("#mark")!.innerHTML = markSvg({ size: 28 });
document.querySelectorAll<HTMLElement>("[data-icon]").forEach((n) => n.replaceWith(icon(n.dataset.icon as IconName)));

const ROLES: Role[] = ["palette", "form", "motion"];
const BLURB: Record<string, string> = {
  palette: "The colour wash. Four moods for the same silhouette.",
  form: "The atmosphere: fog, steam, sparks or dust around the fixed shapes.",
  motion: "How the light moves. Capped below 3 Hz; nothing strobes.",
};
const scene = BUNDLED_SCENES[0];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
document.querySelector("#roles")!.replaceChildren(...ROLES.map((r) => {
  const li = document.createElement("li");
  li.className = "role";
  li.innerHTML = `<span class="badge" style="--hue: var(--role-${r})"><i class="dot"></i>${cap(r)}</span><ol>${scene.options[r].map((o) => `<li>${o.label}</li>`).join("")}</ol><p>${BLURB[r]}</p>`; // scene labels are loader-validated strings
  return li;
}));

const canvas = document.querySelector<HTMLCanvasElement>("#flock")!;
const narrow = () => innerWidth < 960;
const MODES: Record<string, () => BoidMode> = {
  hero: () => ({ kind: "roam", home: narrow() ? { x: 0.1, y: 0.04, w: 0.8, h: 0.4 } : { x: 0.56, y: 0.09, w: 0.4, h: 0.26 } }),
  groups: () => ({
    kind: "groups",
    homes: narrow()
      ? [{ x: 0.1, y: 0.05, w: 0.25, h: 0.3 }, { x: 0.4, y: 0.05, w: 0.25, h: 0.3 }, { x: 0.7, y: 0.05, w: 0.25, h: 0.3 }]
      : [{ x: 0.3, y: 0.15, w: 0.2, h: 0.5 }, { x: 0.55, y: 0.15, w: 0.2, h: 0.5 }, { x: 0.8, y: 0.15, w: 0.18, h: 0.5 }],
    tints: ["#e88a6a", "#7fb3d5", "#b48eeb"],
  }),
  roam: () => ({ kind: "roam", home: narrow() ? { x: 0.1, y: 0.04, w: 0.8, h: 0.4 } : { x: 0.4, y: 0.1, w: 0.56, h: 0.8 } }),
  settle: () => ({ kind: "settle", targets: markDots(), box: narrow() ? { x: 0.3, y: 0.02, w: 0.6, h: 0.4 } : { x: 0.56, y: 0.06, w: 0.4, h: 0.5 } }),
};
const flock = mountBoids(canvas, { count: narrow() ? 90 : 200, pointer: true, mode: MODES.settle() });
let current = "settle";
const setMode = (name: string) => { if (name !== current) { current = name; flock.setMode(MODES[name]()); } };
// Takes flight after a beat; the hero's observer then owns the mode.
setTimeout(() => current === "settle" && setMode("hero"), 1600);
let released = false;
setTimeout(() => (released = true), 1600);

const visible = new Map<HTMLElement, number>();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    visible.set(e.target as HTMLElement, e.isIntersecting ? e.intersectionRatio : 0);
    if (e.isIntersecting) e.target.classList.add("in");
  }
  const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0 && released) setMode(top[0].dataset.mode!);
}, { threshold: [0.2, 0.4, 0.6] });
document.querySelectorAll<HTMLElement>("section[data-mode]").forEach((s) => observer.observe(s));

// Header gets its hairline once the hero scrolls under it.
const top = document.querySelector(".top")!;
addEventListener("scroll", () => top.classList.toggle("lined", scrollY > 24), { passive: true });
