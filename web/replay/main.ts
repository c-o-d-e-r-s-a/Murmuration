import { get } from "firebase/database";
import type { ArchivedRound, Choices, Role } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { db, ref, signIn } from "../lib/firebase";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

// P2 /replay (CONTRACTS §9, D-20, D-30): re-runs rounds/{roundId} through the /screen renderer. Read-only; no judge/reimagine/Tiger calls.
// Smoothing: events only move the target; the renderer eases current toward it exactly as it did live.
const DIALS: Role[] = ["palette", "form", "motion"];
const NAME: Record<Role, string> = { palette: "Palette", form: "Form", motion: "Motion", texture: "Texture", mood: "Mood" };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const q = new URLSearchParams(location.search);
const code = (q.get("s") ?? "").toUpperCase();
const roundId = q.get("r") ?? "";
const fail = (m: string) => void ($("#msg").textContent = m);

if (!code || !roundId) fail("Open /replay/?s=CODE&r=ROUND");
else start().catch((e) => fail(`Replay failed: ${e.message ?? e}`));

async function start() {
  await signIn();
  const arc: ArchivedRound | null = (await get(ref(db, `sessions/${code}/rounds/${roundId}`))).val();
  const round = arc?.round;
  if (!arc || !round) return fail(`No archived round ${roundId} in session ${code}`);
  const scene = BUNDLED_SCENES.find((s) => s.id === round.sceneId);
  if (!scene) return fail(`Unknown scene ${round.sceneId}`);
  if (!(round.durationMs > 0) || typeof round.seed !== "number") return fail("Archive is incomplete (no seed or duration)");

  const dur = round.durationMs;
  const events = Object.values(arc.events ?? {}).sort((a, b) => a.t - b.t);
  const finalChoices: Choices = arc.choices ?? {};
  const results = arc.results ?? {};
  const ui = $("#ui");
  const stage = $("#stage");

  // Chrome shared by live and reveal (labels track the current choices, same as /screen during live).
  const people = Object.values(arc.playersSnapshot ?? {});
  const nickOf = (r: Role) => people.find((p) => p.slot === r)?.nick;
  const credit = (r: Role, label?: string) => {
    const row = Object.assign(document.createElement("div"), { className: "dial" });
    const dot = Object.assign(document.createElement("span"), { className: "dot" });
    dot.style.background = `var(--role-${r})`;
    row.append(dot, [nickOf(r), NAME[r], label].filter(Boolean).join(" · "));
    return row;
  };
  const creditsEl = $(".credits");
  const showCredits = (c: Choices) => creditsEl.replaceChildren(...DIALS.filter(nickOf).map((r) => {
    const id = c[r]?.optionId;
    return credit(r, id ? scene.options[r].find((o) => o.id === id)?.label : undefined);
  }));
  $(".prompt").textContent = round.promptText ?? "";
  $(".scene-card").textContent = scene.title;
  $(".card .title").textContent = round.promptText ?? "";

  // Live phase: renderer clock = local ms since mount; events due by that time are applied inside the clock, right before the step loop reads the target.
  const choices: Choices = {};
  let next = 0;
  const t0 = performance.now();
  const now = () => Math.min(dur, performance.now() - t0);
  let m: ReturnType<typeof mountRenderer>;
  const clock = () => {
    const t = now();
    let moved = false;
    for (; next < events.length && events[next].t <= t; next++) {
      choices[events[next].role] = { optionId: events[next].optionId, uid: events[next].uid, at: events[next].t };
      moved = true;
    }
    if (moved) {
      m.setTarget(resolveTarget(scene.options, choices));
      showCredits(choices);
    }
    return t;
  };
  const mount = (c: () => number) => mountRenderer(stage, { background: scene.baseArt.background, baseArt: scene.baseArt, seed: round.seed, clock: c });
  m = mount(clock);
  m.setTarget(resolveTarget(scene.options, choices));
  ui.dataset.s = "live";
  showCredits(choices);

  const countEl = $(".count");
  const frame = () => {
    const t = now();
    const s = Math.ceil((dur - t) / 1000);
    countEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (t < dur) return void requestAnimationFrame(frame);
    finish();
  };
  requestAnimationFrame(frame);

  // t = durationMs: like /screen after lock, remount fresh with the archived final choices (current = target, t = durationMs), then reveal.
  function finish() {
    m.remove();
    m = mount(() => dur);
    m.setTarget(resolveTarget(scene.options, finalChoices));
    showCredits(finalChoices);
    const set = (k: string, v: number | null | undefined, cap: string) => {
      $(`[data-k=${k}] .num`).textContent = v == null ? "--" : v.toFixed(1);
      if (k !== "combined") $(`[data-k=${k}] .cap`).textContent = cap;
    };
    set("author", results.author?.score, results.author ? "" : "no picks");
    set("ai", results.ai?.score, results.ai ? [results.ai.comment, results.ai.fallback ? "(offline judge)" : ""].filter(Boolean).join(" ") : "judge offline");
    set("audience", results.audience?.score, results.audience?.count ? `from ${results.audience.count} ratings` : "no ratings");
    set("combined", results.combined, "");
    stage.classList.add("reveal");
    ui.dataset.s = "reveal";
    const bloom = $("#bloom");
    bloom.classList.remove("go");
    void bloom.offsetWidth;
    bloom.classList.add("go");
  }
}
