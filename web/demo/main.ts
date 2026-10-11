import "../lib/chrome/ui.css";
import "../lib/chrome/instrument.css";
import type { Choices, Role } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { audienceScore, authorScore, combined } from "../../shared/scoring";
import { mountBoids } from "../lib/chrome/boids";
import { icon } from "../lib/chrome/icons";
import { markEl, markSvg } from "../lib/chrome/mark";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

// /demo (art direction §12.4): a compressed round, offline. No Firebase, no timers from the network, no AI — the AI judge
// score is a labelled example. The artwork is the real renderer (same seed → same picture every visit); the phone panel
// reuses the /play instrument styles; the "big screen" is a compact echo of /screen's chrome, not an import of it.

type StepId = "welcome" | "palette" | "form" | "motion" | "lock" | "rate" | "reveal" | "done";
type Step = { id: StepId; short: string; title: string; text: string; screen: "lobby" | "live" | "locked" | "rating" | "reveal" };
// Narration script: one MP3 per step at /narration/demo/step-NN.mp3 (functions/scripts/genDemoNarration.ts). Text is the caption.
const STEPS: Step[] = [
  { id: "welcome", short: "Lobby", screen: "lobby", title: "Three dials, one artwork.",
    text: "Welcome to Murmuration. Three strangers, three dials, one artwork on the big screen, and everyone else judges. Tonight you get all three dials, because it's a demo and nobody's watching." },
  { id: "palette", short: "Palette", screen: "live", title: "You hold the Palette dial.",
    text: "Four options, one tap. Pick a mood for the light and watch the screen ease into it. Nothing snaps; everything glides." },
  { id: "form", short: "Form", screen: "live", title: "Now you're on Form.",
    text: "What the air is made of: smog, sparks, steam or dust. Change your mind as often as you like until the lock." },
  { id: "motion", short: "Motion", screen: "live", title: "Last dial: Motion.",
    text: "How the whole thing breathes. Nothing here flickers faster than three times a second. We checked, twice." },
  { id: "lock", short: "Lock", screen: "locked", title: "Time's up. Hands off.",
    text: "The artwork settles for a moment and the dials go dark. Whatever you built is what gets judged." },
  { id: "rate", short: "Rate", screen: "rating", title: "The room weighs in.",
    text: "Spectators rate one to five, once, no takebacks. Go on, be honest. Be kind. Be at least a little kind." },
  { id: "reveal", short: "Reveal", screen: "reveal", title: "Three judges.",
    text: "The Scene Author ranked every option before you arrived. The AI judge looks at the picture and writes a verdict. The audience is the audience. Average them, and that's your score." },
  { id: "done", short: "Done", screen: "reveal", title: "That's a round.",
    text: "About ninety seconds in real life. Grab a laptop, host a session, and let the room take the dials." },
];
const DIALS: Role[] = ["palette", "form", "motion"];
const HUE: Record<string, string> = { palette: "var(--role-palette)", form: "var(--role-form)", motion: "var(--role-motion)" };
const SEED = 7;
const PROMPT = "A traffic jam that feels like a lullaby";
const ROUND_MS = 90000;
const CANNED_RATINGS = [4, 4, 5, 3, 4, 5, 4, 3, 4]; // nine spectators who were here before you
const AI_EXAMPLE = { score: 7, comment: "Example verdict. In a real round Gemini sees the locked frame and writes this." };
const KEY_H = 72, KEY_GAP = 12;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = BUNDLED_SCENES[0]; // vigilante (Batman in Atlanta)
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
const capitalize = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const buzz = (p: number | number[]) => navigator.vibrate?.(p);

// ---- state ----
let step = 0;
let reached = 0; // furthest step visited; segments up to here are clickable
let choices: Choices = {};
let rating: number | null = null;
let needleAt = -1;

// ---- renderer: the real one, seeded; clock freezes at lock and resumes from the same ms if you step Back ----
const t0 = performance.now();
let offset = 0; // ms subtracted so the clock reads "ms since round start"
let frozen: number | null = null;
let roundStart = 0; // clock() value when the lobby was left; the countdown is cosmetic and reads from it
const clock = () => frozen ?? performance.now() - t0 - offset;
const renderer = mountRenderer($("#stage"), { background: scene.baseArt.background, baseArt: scene.baseArt, seed: SEED, clock });
renderer.setTarget(resolveTarget(scene.options, choices));
function freeze(on: boolean) {
  if (on && frozen === null) frozen = clock();
  else if (!on && frozen !== null) { offset = performance.now() - t0 - frozen; frozen = null; }
}

// ---- narration ----
const audio = new Audio();
audio.preload = "auto";
let unlocked = false; // first "Start" click plays inside the gesture; autoplay policy is satisfied from then on
let muted = localStorage.getItem("demo-muted") === "1";
const missing = new Set<number>();
const capA = $("#cap-a");
audio.addEventListener("error", () => { missing.add(step); capA.textContent = "Narration audio isn't generated yet; the caption is the script."; });
audio.addEventListener("playing", () => { capA.textContent = ""; });
function speak(i = step) {
  if (!unlocked || muted) return;
  if (missing.has(i)) { capA.textContent = "Narration audio isn't generated yet; the caption is the script."; return; }
  audio.src = `/narration/demo/step-${String(i + 1).padStart(2, "0")}.mp3`;
  audio.currentTime = 0;
  audio.play().catch(() => { /* blocked or missing; caption carries it */ });
}
const muteBtn = $<HTMLButtonElement>("#mute");
function paintMute() {
  muteBtn.replaceChildren(icon(muted ? "speakerOff" : "speaker"), el("span", { textContent: muted ? "Muted" : "Narration" }));
  muteBtn.setAttribute("aria-pressed", String(muted));
}
muteBtn.onclick = () => { muted = !muted; localStorage.setItem("demo-muted", muted ? "1" : "0"); paintMute(); if (muted) audio.pause(); else { unlocked = true; speak(); } };
$<HTMLButtonElement>("#replay").onclick = () => { unlocked = true; if (muted) { muted = false; paintMute(); } speak(); };
$("#replay").replaceChildren(icon("replay"), el("span", { textContent: "Replay" }));
$("#exit").replaceChildren(icon("close"));
paintMute();

// ---- chrome ----
$("#mark").innerHTML = markSvg({ size: 28 });
const phone = $("#phone");
const ui = $("#ui");
const stage = $("#stage");
const back = $<HTMLButtonElement>("#back");
const next = $<HTMLButtonElement>("#next");
const segs = $("#segs");
STEPS.forEach((s, i) => {
  const b = el("button", { className: "seg", onclick: () => { if (i <= reached) go(i); } }, el("span", { textContent: `${String(i + 1).padStart(2, "0")} ${s.short}` }));
  b.setAttribute("aria-label", `Step ${i + 1}: ${s.short}`);
  segs.append(b);
});
back.onclick = () => go(step - 1);
next.onclick = () => {
  if (step === 0) { unlocked = true; if (!muted) { audio.src = "/narration/demo/step-02.mp3"; audio.play().catch(() => {}); } }
  if (STEPS[step].id === "done") { location.href = "/host/"; return; }
  go(step + 1);
};
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" && !next.disabled) next.click();
  if (e.key === "ArrowLeft" && !back.disabled) back.click();
});

// Screen chrome (static nodes in index.html)
$(".scene-title").textContent = scene.title;
$(".scene-card").textContent = `${scene.title} · ${scene.author}`;
$(".card .title").textContent = PROMPT;
$(".bar .prompt").textContent = PROMPT;
const countEl = $(".bar .count");
const lobbyDials = $(".lobby .dials");
const joined = $(".joined");
const credits = $(".credits");
const lobbyFlock = $<HTMLCanvasElement>(".lobby .flock");
let lobbyBoids: ReturnType<typeof mountBoids> | null = null;
const phoneFlock = el("canvas", { className: "flock" });
phoneFlock.setAttribute("aria-hidden", "true");
let phoneBoids: ReturnType<typeof mountBoids> | null = null;

function dialRow(role: Role, label: string | null, i: number) {
  const row = el("div", { className: "dial" }, el("span", { className: "dot" }), el("b", { textContent: capitalize(role) }), el("span", { className: label ? "" : "open", textContent: label ?? "open" }));
  (row.firstChild as HTMLElement).style.background = HUE[role];
  row.style.setProperty("--i", String(i));
  return row;
}
const label = (role: Role) => scene.options[role].find((o) => o.id === choices[role]?.optionId)?.label ?? null;

function paintScreen() {
  const s = STEPS[step];
  ui.dataset.s = s.screen;
  stage.classList.toggle("reveal", s.screen === "reveal");
  // Lobby: the three dials, one of which "you" are about to take
  joined.textContent = "1 Creator seat taken by you · 9 Spectators already here";
  lobbyDials.replaceChildren(...DIALS.map((r, i) => dialRow(r, i === 0 ? "you" : null, i)));
  // Live credits: who holds what, filled in as you pick
  credits.replaceChildren(...DIALS.filter((r) => s.screen === "reveal" ? true : choices[r]).map((r, i) => dialRow(r, label(r), i)));
  $(".rail").style.setProperty("--f", "1");
  if (s.screen === "reveal") paintBoard();
}

function scores() {
  const author = authorScore(scene, choices);
  const audience = audienceScore(rating ? [...CANNED_RATINGS, rating] : CANNED_RATINGS);
  return { author, ai: AI_EXAMPLE, audience, total: combined(author?.score ?? null, AI_EXAMPLE.score, audience.score) };
}
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1));
function paintBoard() {
  const { author, ai, audience, total } = scores();
  const set = (k: string, n: number | null | undefined, cap: string) => {
    const row = ui.querySelector(`[data-k="${k}"]`)!;
    row.querySelector(".num")!.textContent = fmt(n);
    const c = row.querySelector(".cap");
    if (c) c.textContent = cap;
  };
  set("author", author?.score, author ? `Your picks ranked ${Object.values(author.perRole).map((v) => `${v}`).join(" · ")} of 10 by the Scene Author` : "No picks yet");
  set("ai", ai.score, ai.comment);
  set("audience", audience.score, `${audience.count} ratings${rating ? ", yours included" : ""} · ${audience.method}`);
  set("combined", total, "");
}

// ---- phone views ----
function head(badge: string, who: Node | string | null, title: string) {
  return el("div", { className: "head" },
    el("div", { className: "top" }, el("span", { className: "badge", textContent: badge })),
    who ? el("div", { className: "who" }, who) : el("div", { className: "who" }),
    el("h1", { textContent: title }));
}
function keys(role: Role) {
  const options = scene.options[role];
  const mine = choices[role]?.optionId;
  const needle = el("i", { className: "needle" });
  const at = options.findIndex((o) => o.id === mine);
  const wrap = el("div", { className: at >= 0 ? "keys has" : "keys" }, needle, ...options.map((o, i) =>
    el("button", { className: o.id === mine ? "key on" : "key", onclick: () => pick(role, o.id) },
      el("span", { textContent: o.label }), el("small", { textContent: `0${i + 1}` }))));
  if (at >= 0) {
    const y = (i: number) => `translateY(${i * (KEY_H + KEY_GAP)}px)`;
    const from = needleAt >= 0 ? needleAt : at;
    needle.style.transform = y(at);
    if (from !== at && !reducedMotion) needle.animate([{ transform: y(from) }, { transform: y(at) }], { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }
  needleAt = at;
  return wrap;
}
function pick(role: Role, optionId: string) {
  choices = { ...choices, [role]: { optionId, uid: "you", at: 0 } };
  renderer.setTarget(resolveTarget(scene.options, choices)); // target only; the loop eases current toward it
  buzz(30);
  paintPhone();
  paintScreen();
  paintNav();
}
function rate(n: number) {
  rating = n;
  buzz(30);
  paintPhone();
  paintNav();
}
function stagger() {
  [...phone.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(Math.min(i, 7))));
}

function paintPhone() {
  const s = STEPS[step];
  phone.style.removeProperty("--hue");
  let kids: (Node | string)[];
  switch (s.id) {
    case "welcome":
      kids = [
        phoneFlock,
        el("div", { className: "brand" }, markEl(28), el("span", { className: "word", textContent: "Murmuration" })),
        el("div", { className: "code" }, "Session", el("b", { textContent: "DEMO" })),
        el("p", { className: "pitch", textContent: "Three people, three dials, one artwork." }),
        el("p", { textContent: "In a real room you'd scan the QR on the big screen and pick a nickname. Here, you're already in." }),
        el("div", { className: "actions" }, el("button", { className: "primary", textContent: "Start", onclick: () => next.click() })),
      ];
      break;
    case "palette": case "form": case "motion": {
      const role = s.id as Role;
      phone.style.setProperty("--hue", HUE[role]);
      const picked = !!choices[role];
      kids = [
        head(`Creator · ${capitalize(role)}`, el("span", { className: picked ? "" : "nudge", textContent: picked ? "Tap another to change it. The screen follows." : "Tap one. Watch the big screen." }), s.title),
        el("div", { className: "prompt", textContent: PROMPT }),
        el("div", { className: "actions" }, keys(role)),
      ];
      break;
    }
    case "lock":
      kids = [
        head("Locked", el("span", {}, el("b", { textContent: "Dials off." }), " The room is about to rate it."), s.title),
        el("p", { textContent: "In a real round the timer is the host's; phones only read it. Your three picks are what gets judged." }),
        el("div", { className: "actions" }, el("div", { className: "card" }, el("span", { className: "badge" }, icon("lock"), "Your picks"),
          ...DIALS.map((r) => el("div", { className: "who" }, el("b", { textContent: capitalize(r) }), label(r) ?? "—")))),
      ];
      break;
    case "rate": {
      const bank = el("div", { className: rating ? "rate" : "rate stamp" }, ...[1, 2, 3, 4, 5].map((n, i) => {
        const b = el("button", { className: rating === n ? "on" : rating ? "dim" : "", textContent: String(n), disabled: !!rating, onclick: () => rate(n) });
        b.style.setProperty("--i", String(i));
        return b;
      }));
      kids = [
        head("Spectator", el("span", {}, "Now you're ", el("b", { textContent: "in the room" }), ", not on a dial"), rating ? "Thanks. That's locked in." : s.title),
        el("p", { textContent: rating ? "Ratings are one per phone, write-once. The big screen never shows who said what." : "One tap, one to five. Once." }),
        el("div", { className: "actions" }, bank, el("div", { className: "scale" }, el("span", { className: "hint", textContent: "1 · not for me" }), el("span", { className: "hint", textContent: "5 · frame it" }))),
      ];
      break;
    }
    case "reveal": {
      const { author, ai, audience, total } = scores();
      const sc = (name: string, n: number | null | undefined, cap: string) => el("div", { className: "sc" }, el("span", { className: "caps", textContent: name }), el("span", { className: "num", textContent: fmt(n) }), el("span", { className: "hint", textContent: cap }));
      const list = el("div", { className: "scores later" },
        sc("Author's Taste", author?.score, "mean of your three picks' ranks"),
        sc("AI Match · example", ai.score, "canned here; Gemini writes it live"),
        sc("Audience", audience.score, `${audience.count} ratings, ×2`),
        el("div", { className: "sc total" }, el("span", { className: "caps", textContent: "Combined" }), el("span", { className: "num", textContent: fmt(total) })));
      list.style.setProperty("--d", reducedMotion ? "0ms" : "2600ms");
      kids = [
        el("div", { className: "card" }, el("span", { className: "badge", textContent: "You made this" }),
          el("div", { className: "pick", textContent: DIALS.map(label).filter(Boolean).join(" · ") || "Nothing picked" }),
          el("p", { className: "hint", textContent: `${scene.title} · "${PROMPT}"` })),
        list,
      ];
      break;
    }
    default:
      kids = [
        head("Round over", null, s.title),
        el("p", { textContent: "Up to three Creators, any number of Spectators, one laptop as host. Rounds are 60, 90 or 120 seconds." }),
        el("div", { className: "actions" },
          el("a", { className: "primary", href: "/host/" }, "Host a session", icon("arrow")),
          el("a", { className: "secondary", href: "/" }, icon("back"), "Back to start")),
      ];
  }
  phone.replaceChildren(...kids);
  stagger();
  phone.classList.remove("enter");
  void phone.offsetWidth; // restart the enter stagger
  phone.classList.add("enter");
}

function paintNav() {
  const s = STEPS[step];
  back.disabled = step === 0;
  back.replaceChildren(icon("back"), el("span", { textContent: "Back" }));
  let blocked = false, text = "Next";
  if (s.id === "welcome") text = "Start";
  if (DIALS.includes(s.id as Role)) { blocked = !choices[s.id as Role]; text = blocked ? `Pick a ${capitalize(s.id)}` : "Next"; }
  if (s.id === "rate") text = rating ? "Reveal" : "Skip to reveal";
  if (s.id === "reveal") text = "Done";
  if (s.id === "done") text = "Host a session";
  next.disabled = blocked;
  next.replaceChildren(el("span", { textContent: text }), icon(s.id === "done" ? "external" : "arrow"));
  [...segs.children].forEach((c, i) => { c.classList.toggle("done", i < step); c.classList.toggle("now", i === step); (c as HTMLButtonElement).disabled = i > reached; });
  $("#cap-n").textContent = String(step + 1).padStart(2, "0");
  $("#cap-h").textContent = s.title;
  $("#cap-p").textContent = s.text;
  capA.textContent = "";
}

function go(i: number) {
  if (i < 0 || i >= STEPS.length) return;
  const was = STEPS[step];
  step = i;
  reached = Math.max(reached, i);
  const s = STEPS[i];
  if (was.screen === "lobby" && s.screen === "live") roundStart = clock(); // the countdown starts now; the sim clock stays monotonic
  freeze(s.screen !== "live" && s.screen !== "lobby");
  if (s.screen === "locked" && was.screen === "live" && !reducedMotion) { const b = $("#bloom"); b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); }
  paintPhone();
  paintScreen();
  paintNav();
  // Boids: only while a lobby is on screen (both the "big screen" lobby and the phone's join card)
  if (s.id === "welcome") {
    lobbyBoids ??= mountBoids(lobbyFlock, { count: 70, seed: 11, alpha: 0.28, mode: { kind: "groups", homes: [{ x: 0.1, y: 0.1, w: 0.25, h: 0.8 }, { x: 0.4, y: 0.1, w: 0.25, h: 0.8 }, { x: 0.7, y: 0.1, w: 0.25, h: 0.8 }], tints: ["#e88a6a", "#7fb3d5", "#b48eeb"] } });
    phoneBoids ??= mountBoids(phoneFlock, { count: 56, seed: 3, alpha: 0.3, mode: { kind: "roam", home: { x: 0.08, y: 0.1, w: 0.84, h: 0.8 } } });
  } else {
    lobbyBoids?.destroy(); lobbyBoids = null;
    phoneBoids?.destroy(); phoneBoids = null;
  }
  if (i !== 0) speak(i); // step 0 can't autoplay before a gesture; Replay plays it
  history.replaceState(null, "", `#${s.id}`);
}

// Countdown on the "big screen" bar: cosmetic, from the renderer clock, so lock and Back agree with the artwork.
setInterval(() => {
  const left = Math.max(0, ROUND_MS - (clock() - roundStart));
  const sec = Math.ceil(left / 1000);
  countEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  countEl.classList.toggle("urgent", sec <= 10 && frozen === null);
}, 250);

// Deep link: #motion etc. jumps straight to a step (used for QA). Steps before it count as reached.
const hash = location.hash.slice(1) as StepId;
const start = Math.max(0, STEPS.findIndex((s) => s.id === hash));
reached = start;
go(start);
