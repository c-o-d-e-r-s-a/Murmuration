import QRCode from "qrcode";
import { ROLES, SNAPSHOT_H, SNAPSHOT_JPEG_QUALITY, SNAPSHOT_W } from "../../shared/contracts";
import type { Choices, Player, Role, Round } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { db, onValue, ref, serverNow, signIn } from "../lib/firebase";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

// B5: passive /screen (D-10). Subscribes, renders the colour wash from choices, shows lobby/live/lock/reveal chrome.
// Solo scope (BUILD_ORDER §8): three dials. Scores/reveal numerals are P1-4; snapshot upload (T4a) is P1-1.
const DIALS: Role[] = ["palette", "form", "motion"];
const NAME: Record<Role, string> = { palette: "Palette", form: "Form", motion: "Motion", texture: "Texture", mood: "Mood" };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const ui = $("#ui");
const q = new URLSearchParams(location.search);
const code = (q.get("s") ?? "").toUpperCase();
const debug = q.get("debug") === "1";
if (!code) $("#msg").textContent = "Open /screen/?s=CODE from the host page";
else start();

function dialRow(role: Role, nick: string | null, label?: string) {
  const row = Object.assign(document.createElement("div"), { className: "dial" });
  const dot = Object.assign(document.createElement("span"), { className: "dot" });
  dot.style.background = `var(--role-${role})`;
  const text = document.createElement("span");
  text.textContent = nick ? [nick, NAME[role], label].filter(Boolean).join(" · ") : `${NAME[role]} · open`;
  if (!nick) text.className = "open";
  row.append(dot, text);
  return row;
}

async function start() {
  await signIn();
  const base = `sessions/${code}`;
  const loaded = new Set<string>();
  let round: Round | null = null;
  let choices: Choices = {};
  let players: Record<string, Player> = {};
  let mounted: (ReturnType<typeof mountRenderer> & { key: string }) | null = null;
  let snapshot: string | null = null; // base64 JPEG of the locked frame (D-21), in memory until P1-1

  // CONTRACTS §5: t = serverNow() - startsAt clamped to the round; exactly durationMs once locked. Lobby: renderer's own clock.
  const clock = () => {
    if (round?.startsAt == null) return null;
    return round.status === "live" ? Math.max(0, Math.min(round.durationMs, serverNow() - round.startsAt)) : round.durationMs;
  };

  // T4a stub: grab the first full frame of the locked mount, scaled to SNAPSHOT_W x SNAPSHOT_H.
  function capture(m: typeof mounted) {
    if (m !== mounted) return;
    if (!m.stats.frames) return void requestAnimationFrame(() => capture(m));
    const c = Object.assign(document.createElement("canvas"), { width: SNAPSHOT_W, height: SNAPSHOT_H });
    c.getContext("2d")!.drawImage($<HTMLCanvasElement>("#stage canvas"), 0, 0, SNAPSHOT_W, SNAPSHOT_H);
    const url = c.toDataURL("image/jpeg", SNAPSHOT_JPEG_QUALITY);
    snapshot = url.slice(url.indexOf(",") + 1);
    // TODO(P1-1): T4a — if results/judgeRequestedAt is null, claim it (transaction) and call judgeRound({ sessionCode, roundId, snapshotJpegBase64: snapshot }).
    if (!debug) return;
    console.log("snapshot", { width: c.width, height: c.height, kb: +((snapshot.length * 3) / 4 / 1024).toFixed(1), base64Length: snapshot.length });
    const a = Object.assign(document.querySelector<HTMLAnchorElement>("#snap") ?? document.body.appendChild(document.createElement("a")), {
      id: "snap", href: url, download: `snapshot-${code}-${round!.id}.jpg`, textContent: "snapshot.jpg",
    });
    a.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:9;color:#fff;font:14px monospace";
  }

  const playUrl = `${location.origin}/play/?s=${code}`;
  const qr = document.createElement("canvas");
  QRCode.toCanvas(qr, playUrl, { width: Math.round(window.innerHeight * 0.5), margin: 0, color: { dark: "#0B0B0F", light: "#F4EFE6" } });
  $(".qr").append(qr);
  $(".code").textContent = code;
  $(".url").textContent = playUrl;

  const countEl = $(".count");
  const tick = () => {
    if (round?.status !== "live" || round.startsAt == null) return;
    const left = Math.max(0, Math.min(round.durationMs, round.startsAt + round.durationMs - serverNow()));
    const s = Math.ceil(left / 1000);
    countEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    countEl.classList.toggle("urgent", s <= 10);
  };
  setInterval(tick, 100);

  function render() {
    // Wait for every listener once, so a refreshed screen's first target is the real one (no catch-up animation).
    if (loaded.size < 3 || !round) return;
    const scene = BUNDLED_SCENES.find((s) => s.id === round!.sceneId);
    if (!scene) return void ($("#msg").textContent = `unknown scene ${round.sceneId}`);
    $("#msg").textContent = "";
    const status = round.status;
    // Remount per scene, round and phase. The live layer depends on target history, so on leaving "live" every screen
    // (refreshed or not) remounts fresh with the final choices, current = target, t = durationMs: one canonical locked frame.
    const phase = status === "lobby" || status === "live" ? status : "locked";
    const key = [scene.id, round.id, phase, phase === "locked" ? ROLES.map((r) => choices[r]?.optionId).join() : ""].join("|");
    if (mounted?.key !== key) {
      mounted?.remove();
      mounted = { key, ...mountRenderer($("#stage"), { background: scene.baseArt.background, baseArt: scene.baseArt, seed: round.seed, clock }) };
      if (phase === "locked") capture(mounted);
    }
    mounted.setTarget(resolveTarget(scene.options, status === "lobby" ? undefined : choices));
    ui.dataset.s = status;

    const people = Object.values(players).filter((p) => !p.removed);
    const nickOf = (r: Role) => people.find((p) => p.slot === r)?.nick ?? null;
    const labelOf = (r: Role) => {
      const id = choices[r]?.optionId;
      return scene.options[r].find((o) => o.id === id)?.label;
    };

    $(".scene-title").textContent = scene.title;
    $(".scene-card").textContent = scene.title;
    $(".prompt").textContent = round.promptText ?? "";
    $(".card .title").textContent = round.promptText ?? "";
    $(".joined").textContent = `Creators ${DIALS.filter(nickOf).length}/${DIALS.length} joined · ${people.length} here`;
    $(".dials").replaceChildren(...DIALS.map((r) => dialRow(r, nickOf(r))));
    $(".credits").replaceChildren(...DIALS.filter(nickOf).map((r) => dialRow(r, nickOf(r), labelOf(r))));
    tick();
  }

  const sub = <T>(path: string, set: (v: T) => void) =>
    onValue(ref(db, `${base}/${path}`), (s) => {
      set(s.val());
      loaded.add(path);
      render();
    });
  sub<Round>("round", (v) => (round = v));
  sub<Choices>("choices", (v) => (choices = v ?? {}));
  sub<Record<string, Player>>("players", (v) => (players = v ?? {}));
}
