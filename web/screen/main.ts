import QRCode from "qrcode";
import { RATING_MAX_MS, ROLES, SETTLE_MS, SNAPSHOT_H, SNAPSHOT_JPEG_QUALITY, SNAPSHOT_W } from "../../shared/contracts";
import type { Choices, JudgeRoundRequest, JudgeRoundResponse, Player, Results, Role, Round } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { db, functions, httpsCallable, onValue, ref, runTransaction, serverNow, serverTimestamp, signIn } from "../lib/firebase";
import { resolveTarget } from "../lib/renderer/params";
import { mountRenderer } from "../lib/renderer/sketch";

// B5: passive /screen (D-10). Subscribes, renders the colour wash from choices, shows lobby/live/lock/reveal chrome.
// Solo scope (BUILD_ORDER §8): three dials. Its only writes: the judgeRequestedAt claim and the judgeRound call (T4a).
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
  let results: Results = {};
  let seenRender = false; // first render already in reveal (refresh): show final scores, no catch-up animation
  const shown = new Map<string, number | null>(); // `${round}:${key}` -> value already counted up
  let mounted: (ReturnType<typeof mountRenderer> & { key: string }) | null = null;
  let snapshot: string | null = null; // base64 JPEG of the locked frame (D-21)

  // CONTRACTS §5: t = serverNow() - startsAt clamped to the round; exactly durationMs once locked. Lobby: renderer's own clock.
  const clock = () => {
    if (round?.startsAt == null) return null;
    return round.status === "live" ? Math.max(0, Math.min(round.durationMs, serverNow() - round.startsAt)) : round.durationMs;
  };

  // T4a, once settle has elapsed: whoever wins judgeRequestedAt (null -> server time) sends the frame. Any error means the
  // function already wrote the fallback or the host's 25 s cap will reveal without it (CONTRACTS §7); never retry.
  async function judge(roundId: string, lockedAt: number, jpeg: string) {
    await new Promise((r) => setTimeout(r, lockedAt + SETTLE_MS - serverNow()));
    if (round?.id !== roundId || (round.status !== "locked" && round.status !== "rating")) return;
    try {
      const { committed } = await runTransaction(ref(db, `${base}/results/judgeRequestedAt`), (v) => (v == null ? serverTimestamp() : undefined));
      if (committed) await httpsCallable<JudgeRoundRequest, JudgeRoundResponse>(functions, "judgeRound")({ sessionCode: code, roundId, snapshotJpegBase64: jpeg });
    } catch (e) {
      console.warn("judgeRound", e);
    }
  }

  // P1-6: lock thunk now, bloom (flash + seeded dots + swell) once SETTLE_MS has elapsed, i.e. after the frame was captured.
  // Skipped on a late refresh. Audio is best-effort: a suspended AudioContext (no gesture yet) just stays silent.
  const actx = new AudioContext();
  addEventListener("pointerdown", () => void actx.resume(), { once: true });
  addEventListener("keydown", () => void actx.resume(), { once: true });
  function tone(f0: number, f1: number, dur: number, gain: number, attack: number) {
    if (actx.state !== "running") return;
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur);
  }
  let revealed = "";
  async function reveal(r: Round) {
    const lockedAt = r.lockedAt ?? 0;
    if (revealed === r.id || serverNow() - lockedAt > SETTLE_MS + 1000) return;
    revealed = r.id;
    if (serverNow() - lockedAt < 500) tone(90, 45, 0.5, 0.35, 0.01); // lock
    await new Promise((res) => setTimeout(res, lockedAt + SETTLE_MS - serverNow()));
    if (round?.id !== r.id || (round.status !== "locked" && round.status !== "rating")) return;
    tone(220, 440, 1.2, 0.15, 0.9); // bloom: rising swell
    const bloomEl = $("#bloom");
    bloomEl.classList.remove("go");
    void bloomEl.offsetWidth;
    bloomEl.classList.add("go");
    // 60 dots from round.seed (mulberry32), burst outward over 900 ms with the bloom front.
    let s = r.seed >>> 0;
    const rnd = () => ((s = (s + 0x6d2b79f5) >>> 0), (((s ^ (s >>> 15)) * (1 | s)) >>> 0) / 4294967296);
    const cv = $<HTMLCanvasElement>("#burst");
    cv.width = innerWidth;
    cv.height = innerHeight;
    const g = cv.getContext("2d")!;
    const dots = Array.from({ length: 60 }, () => ({ a: rnd() * Math.PI * 2, v: 0.35 + rnd() * 0.65, r: 2 + rnd() * 2.5 }));
    const reach = Math.hypot(cv.width, cv.height) * 0.7;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      g.clearRect(0, 0, cv.width, cv.height);
      if (p >= 1) return;
      g.fillStyle = `rgba(244,239,230,${0.35 * (1 - p)})`;
      const d = reach * (1 - (1 - p) ** 3);
      for (const k of dots) {
        g.beginPath();
        g.arc(cv.width / 2 + Math.cos(k.a) * d * k.v, cv.height / 2 + Math.sin(k.a) * d * k.v, k.r, 0, Math.PI * 2);
        g.fill();
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Grab the first full frame of the locked mount, scaled to SNAPSHOT_W x SNAPSHOT_H.
  function capture(m: typeof mounted) {
    if (m !== mounted) return;
    if (!m.stats.frames) return void requestAnimationFrame(() => capture(m));
    const c = Object.assign(document.createElement("canvas"), { width: SNAPSHOT_W, height: SNAPSHOT_H });
    c.getContext("2d")!.drawImage($<HTMLCanvasElement>("#stage canvas"), 0, 0, SNAPSHOT_W, SNAPSHOT_H);
    const url = c.toDataURL("image/jpeg", SNAPSHOT_JPEG_QUALITY);
    snapshot = url.slice(url.indexOf(",") + 1);
    judge(round!.id, round!.lockedAt ?? 0, snapshot);
    reveal(round!);
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
  const rail = $(".rail");
  // Rail drains once over the whole window: toward the 25 s cap until verdict.ready fixes the end at ratingEndsAt (D-15).
  // Redrawn every frame; a re-targeted end eases in over ~240 ms instead of jumping.
  let railEnd = 0;
  let railLast = 0;
  const railFrame = (ms: number) => {
    requestAnimationFrame(railFrame);
    const dt = ms - railLast;
    railLast = ms;
    if (round?.status !== "rating" || !round.ratingEndsAt || !round.lockedAt) return void (railEnd = 0);
    const from = round.lockedAt + SETTLE_MS;
    const end = results.verdict?.ready ? round.ratingEndsAt : from + RATING_MAX_MS;
    railEnd = railEnd ? railEnd + (end - railEnd) * (1 - Math.exp(-dt / 80)) : end;
    rail.style.transform = `scaleX(${Math.min(1, Math.max(0, (railEnd - serverNow()) / (railEnd - from)))})`;
  };
  requestAnimationFrame(railFrame);
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
    if (loaded.size < 4 || !round) return;
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
    $("#stage").classList.toggle("reveal", status === "reveal");
    syncReimagined(status === "reveal" && results.reimagined?.status === "ready" ? results.reimagined.url : undefined);
    if (status === "reveal") renderScores(!seenRender);
    else ui.classList.remove("instant");
    seenRender = true;
    syncVoice();
    tick();
  }

  // P1-4 Beats 6-8: numerals count up 0 -> score over 600 ms (§5.3 rule 7); a refreshed screen shows final values at once.
  function countUp(el: HTMLElement, key: string, val: number | null | undefined, delay: number, instant: boolean) {
    const id = `${round!.id}:${key}`;
    if (shown.get(id) === (val ?? null)) return;
    shown.set(id, val ?? null);
    const tok = (el as any)._tok = {};
    if (val == null) return void (el.textContent = "--");
    if (instant) return void (el.textContent = val.toFixed(1));
    const t0 = performance.now() + delay;
    const step = () => {
      if ((el as any)._tok !== tok) return;
      const p = Math.min(1, Math.max(0, (performance.now() - t0) / 600));
      const v = val * (1 - (1 - p) ** 3);
      el.textContent = p >= 1 || p > 1 - 100 / 600 ? v.toFixed(1) : String(Math.round(v));
      if (p < 1) requestAnimationFrame(step);
    };
    step();
  }

  function renderScores(instant: boolean) {
    if (instant) ui.classList.add("instant");
    const num = (k: string) => $<HTMLElement>(`[data-k=${k}] .num`);
    const cap = (k: string) => $<HTMLElement>(`[data-k=${k}] .cap`);
    countUp(num("author"), "author", results.author?.score, 200, instant);
    countUp(num("ai"), "ai", results.ai?.score, 600, instant);
    countUp(num("audience"), "audience", results.audience?.score, 1000, instant);
    countUp(num("combined"), "combined", results.combined, 1700, instant);
    cap("author").textContent = results.author ? "" : "no picks";
    cap("ai").textContent = results.ai ? [results.ai.comment, results.ai.fallback ? "(offline judge)" : ""].filter(Boolean).join(" ") : "judge offline";
    cap("audience").textContent = results.audience?.count ? `from ${results.audience.count} ratings` : "no ratings";
  }

  // P1-7 part 2 (Beat 10): passive. Preload the image; only when it has loaded, shrink the artwork and crossfade it in.
  // Anything else (absent, pending, failed, skipped, load error) leaves the reveal untouched.
  const rxImg = $<HTMLImageElement>(".reimagined img");
  function syncReimagined(url?: string) {
    if ((rxImg.dataset.u || undefined) === url) return;
    rxImg.dataset.u = url ?? "";
    ui.classList.remove("rx");
    $("#stage").classList.remove("rx");
    if (!url) return void rxImg.removeAttribute("src");
    rxImg.onload = () => {
      if (rxImg.dataset.u !== url) return;
      ui.classList.add("rx");
      $("#stage").classList.add("rx");
    };
    rxImg.onerror = () => void (rxImg.dataset.u = "");
    rxImg.src = url;
  }

  // Verdict audio at reveal (D-15, RISKS §2). One try per round+url; if autoplay is blocked, the Play button is the gesture.
  const voice = new Audio();
  const playBtn = $<HTMLButtonElement>(".play-verdict");
  let voiceKey = "";
  playBtn.onclick = () => void voice.play().then(() => (playBtn.hidden = true)).catch(() => {});
  function syncVoice() {
    const url = round?.status === "reveal" ? results.verdict?.audioUrl : null;
    if (!url) {
      if (voiceKey) voice.pause();
      voiceKey = "";
      playBtn.hidden = true;
      return;
    }
    const key = `${round!.id}|${url}`;
    if (key === voiceKey) return;
    voiceKey = key;
    voice.src = url;
    voice.play().then(() => (playBtn.hidden = true), () => (playBtn.hidden = false));
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
  sub<Results>("results", (v) => (results = v ?? {}));
}
