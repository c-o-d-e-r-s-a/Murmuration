import { get, push } from "firebase/database";
import QRCode from "qrcode";
import {
  DEFAULT_DURATION_MS, DURATIONS_MS, HOST_TICK_MS, MIN_CREATORS, NICK_MAX, NICK_MIN, RATING_EXTEND_STEP_MS, RATING_MIN_MS,
  SESSION_CODE_ALPHABET, SESSION_CODE_LEN,
} from "../../shared/contracts";
import type { Choices, Player, Rating, Results, Role, Round, Scene, SessionMeta } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { audienceScore, authorScore, combined } from "../../shared/scoring";
import { db, onValue, ref, serverNow, serverTimestamp, set, signIn, update } from "../lib/firebase";
import { botPlan, drawPrompt, due, ratingCap } from "./machine";

// B2 lobby (session, QR, scene, duration, players, slots, bots) + B4 state machine T1–T8 (ROUND_STATE_MACHINE §2, D-10).
// Solo scope (BUILD_ORDER §8): only three assignable roles; texture/mood stay neutral. Rotation is P1-5; ratings/judge/reimagine/Tiger are P1.
const SLOT_ROLES: Role[] = ["palette", "form", "motion"];
const CODE_KEY = "murmuration.hostCode";

const app = document.querySelector<HTMLElement>("#app")!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

function newCode() {
  let c = "";
  for (let i = 0; i < SESSION_CODE_LEN; i++) c += SESSION_CODE_ALPHABET[Math.floor(Math.random() * SESSION_CODE_ALPHABET.length)];
  return c;
}

/**
 * Session-relative paths that set a lobby preview prompt and mark it used (T8; becomes the round prompt at START).
 * Null when no unused prompt is left and `allowReset` is false.
 */
function promptPaths(scene: Scene, used: Record<string, true> | undefined, except: string | null, allowReset = true) {
  const { prompt, reset } = drawPrompt(scene, used, except);
  if (reset && !allowReset) return null;
  const up: Record<string, unknown> = {};
  if (reset) for (const p of scene.prompts) up[`meta/usedPromptIds/${scene.id}:${p.id}`] = null;
  if (prompt) Object.assign(up, { "round/promptId": prompt.id, "round/promptText": prompt.text, [`meta/usedPromptIds/${scene.id}:${prompt.id}`]: true });
  return up;
}

/** T1: create session + lobby round. Sequential: round's rule reads meta.hostUid from the stored tree. */
async function createSession(uid: string) {
  let code = newCode();
  while ((await get(ref(db, `sessions/${code}/meta`))).exists()) code = newCode();
  const scene = BUNDLED_SCENES[0];
  await set(ref(db, `sessions/${code}/meta`), { hostUid: uid, sceneId: scene.id, createdAt: serverTimestamp(), roundCounter: 0 });
  await set(ref(db, `sessions/${code}/round`), { id: "r0", sceneId: scene.id, status: "lobby", durationMs: DEFAULT_DURATION_MS, statusVersion: 0 });
  await update(ref(db, `sessions/${code}`), promptPaths(scene, {}, null)!);
  return code;
}

async function start() {
  const uid = await signIn();
  const param = new URLSearchParams(location.search).get("s");
  let code = (param ?? localStorage.getItem(CODE_KEY) ?? "").toUpperCase();
  const existing = code ? (await get(ref(db, `sessions/${code}/meta`))).val() : null;
  if (existing && existing.hostUid !== uid) throw new Error(`session ${code} belongs to another host`);
  if (!existing) code = await createSession(uid);
  localStorage.setItem(CODE_KEY, code);
  history.replaceState(null, "", `?s=${code}`);
  mount(code);
}

function mount(code: string) {
  const base = `sessions/${code}`;
  const playUrl = `${location.origin}/play/?s=${code}`; // trailing slash: Vite dev 404s "/play"
  let round: Round | null = null;
  let players: Record<string, Player> = {};
  let meta: SessionMeta | null = null;
  let choices: Choices = {};
  let ratings: Record<string, Rating> = {};
  let results: Results = {};
  const loaded = new Set<string>(); // the tick acts only after every listener has fired once (refresh-safe)
  let busy = false;

  const canvas = el("canvas");
  QRCode.toCanvas(canvas, playUrl, { width: 240 });
  const sceneSel = el("select", { onchange: () => {
    const scene = BUNDLED_SCENES.find((s) => s.id === sceneSel.value)!;
    write({ "meta/sceneId": scene.id, "round/sceneId": scene.id, "round/promptId": null, "round/promptText": null, ...promptPaths(scene, meta?.usedPromptIds, null) });
  } }, ...BUNDLED_SCENES.map((s) => el("option", { value: s.id, textContent: s.title })));
  const durSel = el("select", { onchange: () => update(ref(db, `${base}/round`), { durationMs: Number(durSel.value) }) },
    ...DURATIONS_MS.map((d) => el("option", { value: String(d), textContent: `${d / 1000} s` })));
  const list = el("div");
  const count = el("div");

  const newBtn = el("button", { textContent: "New session", onclick: () => {
    if (!confirm("Start a brand new session? Phones on the old code are orphaned.")) return;
    localStorage.removeItem(CODE_KEY);
    location.href = location.pathname;
  } });

  const statusEl = el("h2");
  const promptEl = el("span");
  const scoresEl = el("div");
  const errEl = el("div");
  errEl.style.color = "#c33";
  const startBtn = el("button", { textContent: "Start", onclick: () => startRound() });
  const rerollBtn = el("button", { textContent: "Reroll prompt", onclick: () => reroll() });
  const nextBtn = el("button", { textContent: "New round", onclick: () => newRound() });
  const resetBtn = el("button", { textContent: "Reset round", onclick: () => reset() });

  app.replaceChildren(
    el("h1", { textContent: `Host — ${code}` }),
    canvas,
    el("div", {}, el("a", { href: playUrl, textContent: playUrl })),
    el("p", {}, "Scene ", sceneSel, " Duration ", durSel),
    statusEl,
    el("p", {}, "Prompt: ", promptEl, " ", rerollBtn),
    el("p", {}, startBtn, " ", nextBtn, " ", resetBtn),
    scoresEl,
    errEl,
    el("p", {}, el("button", { textContent: "Add 3 bots", onclick: () => addBots(3) }), " ", newBtn),
    count,
    list,
  );

  const scene = () => BUNDLED_SCENES.find((s) => s.id === round?.sceneId);
  const filled = () => SLOT_ROLES.filter((r) => round?.slots?.[r]).length;
  const v = () => round!.statusVersion + 1;

  /** One multi-path update at the session root; `busy` stops the tick re-firing a step before it settles. */
  function write(up: Record<string, unknown>) {
    busy = true;
    errEl.textContent = "";
    return update(ref(db, base), up)
      .catch(async (e) => {
        errEl.textContent = `write failed: ${e.message}`;
        round = (await get(ref(db, `${base}/round`))).val(); // the revert snapshot is older than our optimistic one, so the listener drops it
      })
      .finally(() => (busy = false));
  }

  /** T2 START: preview prompt (or a fresh draw) becomes the round prompt; clears the previous round's data. */
  function startRound() {
    const sc = scene();
    if (!round || !meta || !sc || busy || round.status !== "lobby" || filled() < MIN_CREATORS) return;
    const n = meta.roundCounter + 1;
    const up: Record<string, unknown> = {
      ...(round.promptId ? {} : promptPaths(sc, meta.usedPromptIds, null)),
      "round/id": `r${n}`, "round/seed": Math.floor(Math.random() * 2 ** 32), "round/startsAt": serverNow(),
      "round/lockedAt": null, "round/ratingEndsAt": null, "round/status": "live", "round/statusVersion": v(),
      choices: null, events: null, ratings: null, results: null, "meta/roundCounter": n,
    };
    for (const [uid, p] of Object.entries(players)) {
      if (p.removed) continue;
      const slot = SLOT_ROLES.find((r) => round!.slots?.[r] === uid) ?? null;
      up[`players/${uid}/role`] = slot ? "creator" : "spectator";
      up[`players/${uid}/slot`] = slot;
    }
    write(up);
  }

  /** Shared by T6 and T7: back to lobby with a new preview prompt; slots stay (rotation is P1-5). */
  function toLobby(): Record<string, unknown> {
    const sc = scene();
    return {
      "round/status": "lobby", "round/startsAt": null, "round/lockedAt": null, "round/ratingEndsAt": null,
      "round/promptId": null, "round/promptText": null, "round/statusVersion": v(),
      choices: null, events: null, ratings: null, results: null,
      ...(sc ? promptPaths(sc, meta?.usedPromptIds, round!.promptId) : {}),
    };
  }

  /** T6 NEW_ROUND: archive to rounds/{id}, then lobby. Events aren't subscribed on /host, so read once. */
  function newRound() {
    if (round?.status !== "reveal" || busy) return;
    busy = true;
    get(ref(db, `${base}/events`)).then((s) => {
      const playersSnapshot = Object.fromEntries(Object.entries(players).map(([uid, p]) => [uid, { nick: p.nick, slot: p.slot ?? null }]));
      write({ [`rounds/${round!.id}`]: { round, choices, events: s.val(), ratings, results, playersSnapshot }, ...toLobby() });
    }, (e) => {
      busy = false;
      errEl.textContent = `archive read failed: ${e.message}`;
    });
  }

  /** T7 RESET: lobby without archiving; the aborted prompt becomes drawable again. */
  function reset() {
    if (!round || busy || round.status === "lobby" || !confirm("Reset this round? Nothing is archived.")) return;
    const old = round.promptId ? { [`meta/usedPromptIds/${round.sceneId}:${round.promptId}`]: null } : {};
    write({ ...toLobby(), ...old });
  }

  /** T8 REROLL: lobby only; the previous preview stays used. */
  function reroll() {
    const sc = scene();
    if (round?.status !== "lobby" || !sc || busy) return;
    const up = promptPaths(sc, meta?.usedPromptIds, round.promptId, false);
    if (!up) return void (errEl.textContent = "No unused prompts left for this scene.");
    write(up);
  }

  /** Timer steps T3/T4/T5 derived from server timestamps, so a refreshed host resumes late but correctly. */
  function tickMachine(now: number) {
    const r = round!;
    const step = due(r, now, results.verdict?.ready === true);
    if (step === "T3") {
      const sc = scene();
      write({ "round/status": "locked", "round/lockedAt": now, "round/statusVersion": v(), "results/author": sc ? authorScore(sc, choices) : null });
    } else if (step === "T4") {
      write({ "round/status": "rating", "round/ratingEndsAt": now + RATING_MIN_MS, "round/statusVersion": v() });
    } else if (step === "extend") {
      write({ "round/ratingEndsAt": Math.min(r.ratingEndsAt! + RATING_EXTEND_STEP_MS, ratingCap(r)) });
    } else if (step === "T5") {
      const audience = audienceScore(Object.values(ratings));
      write({
        "round/status": "reveal", "round/statusVersion": v(),
        "results/audience": audience, "results/combined": combined(results.author?.score, results.ai?.score, audience.score),
      });
    }
  }

  // Bots (D-29): first pick at ~5 s, then 1–2 changes. lastT skips picks already past when the host reloads mid-round.
  const botPlans = new Map<Role, number[]>();
  let planRound = "";
  let lastT = 0;
  function tickBots(now: number) {
    const sc = scene();
    if (round?.status !== "live" || !round.startsAt || !sc) return;
    const t = now - round.startsAt;
    if (planRound !== round.id) {
      planRound = round.id;
      botPlans.clear();
      lastT = t;
    }
    for (const role of SLOT_ROLES) {
      const uid = round.slots?.[role];
      if (!uid || !players[uid]?.isBot) continue;
      if (!botPlans.has(role)) botPlans.set(role, botPlan(round.durationMs));
      if (!botPlans.get(role)!.some((at) => at > lastT && at <= t)) continue;
      const opts = sc.options[role].filter((o) => o.id !== choices[role]?.optionId);
      const optionId = opts[Math.floor(Math.random() * opts.length)].id;
      const key = push(ref(db, `${base}/events`)).key!;
      update(ref(db, base), {
        [`choices/${role}`]: { optionId, uid, at: serverTimestamp() },
        [`events/${key}`]: { t: Math.min(round.durationMs, t), role, optionId, uid },
      });
    }
    lastT = t;
  }

  const fmt = (x: number | null | undefined) => (x == null ? "–" : x.toFixed(1));
  function renderRound(now: number) {
    if (!round) return;
    const s = round.status;
    const left = s === "live" ? round.startsAt! + round.durationMs - now : s === "rating" ? round.ratingEndsAt! - now : 0;
    statusEl.textContent = `Round ${round.id} · ${s}${left > 0 ? ` · ${Math.ceil(left / 1000)} s` : ""}`;
    promptEl.textContent = round.promptText ?? "(drawn at start)";
    scoresEl.textContent = s === "lobby" ? "" : `Author ${fmt(results.author?.score)} · AI ${fmt(results.ai?.score)} · Audience ${fmt(results.audience?.score)} (${results.audience?.count ?? Object.keys(ratings).length} votes) · Combined ${fmt(results.combined)}`;
    rerollBtn.hidden = startBtn.hidden = s !== "lobby";
    startBtn.disabled = filled() < MIN_CREATORS;
    startBtn.title = startBtn.disabled ? `Needs ${MIN_CREATORS} filled slots` : "";
    nextBtn.hidden = s !== "reveal";
    resetBtn.hidden = s === "lobby";
    sceneSel.disabled = durSel.disabled = s !== "lobby";
  }

  setInterval(() => {
    const now = serverNow();
    renderRound(now);
    if (!round || busy || loaded.size < 6) return;
    tickBots(now);
    tickMachine(now);
  }, HOST_TICK_MS);

  // Writes: assign (or clear) a slot. One multi-path update keeps round.slots and players/*/slot in step.
  function assign(uid: string, role: Role | "") {
    const up: Record<string, unknown> = {};
    const slots = round?.slots ?? {};
    const prev = players[uid]?.slot;
    if (prev) up[`round/slots/${prev}`] = null;
    if (role) {
      const displaced = slots[role];
      if (displaced && displaced !== uid) {
        up[`players/${displaced}/slot`] = null;
        up[`players/${displaced}/role`] = "spectator";
      }
      up[`round/slots/${role}`] = uid;
    }
    up[`players/${uid}/slot`] = role || null;
    up[`players/${uid}/role`] = role ? "creator" : "spectator";
    update(ref(db, base), up);
  }

  function remove(uid: string) {
    const prev = players[uid]?.slot;
    const up: Record<string, unknown> = { [`players/${uid}/removed`]: true, [`players/${uid}/slot`]: null, [`players/${uid}/role`]: "spectator" };
    if (prev) up[`round/slots/${prev}`] = null;
    update(ref(db, base), up);
  }

  function addBots(n: number) {
    const up: Record<string, unknown> = {};
    const free = SLOT_ROLES.filter((r) => !round?.slots?.[r]);
    let i = 1;
    for (let b = 0; b < n; b++) {
      while (players[`bot_${i}`] && !players[`bot_${i}`].removed) i++;
      const uid = `bot_${i}`;
      const role = free.shift();
      up[`players/${uid}`] = {
        nick: `Bot ${i}`, joinedAt: serverTimestamp(), connected: true, lastSeen: serverTimestamp(),
        role: role ? "creator" : "spectator", queuePos: serverTimestamp(), isBot: true, ...(role ? { slot: role } : {}),
      };
      if (role) up[`round/slots/${role}`] = uid;
      i++;
    }
    update(ref(db, base), up);
  }

  function renderPlayers() {
    if (list.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return; // don't eat typing
    const live = Object.entries(players).filter(([, p]) => !p.removed).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    const filled = SLOT_ROLES.filter((r) => round?.slots?.[r]).length;
    count.textContent = `Creators ${filled}/${SLOT_ROLES.length} · Spectators ${live.length - filled} · Players ${live.length}`;
    list.replaceChildren(...live.map(([uid, p]) => {
      const nick = el("input", { value: p.nick, maxLength: NICK_MAX, onchange: () => {
        const v = nick.value.trim().slice(0, NICK_MAX);
        if (v.length >= NICK_MIN) update(ref(db, `${base}/players/${uid}`), { nick: v });
        else nick.value = p.nick;
      } });
      const slot = el("select", { onchange: () => assign(uid, slot.value as Role | "") },
        el("option", { value: "", textContent: "Spectator" }),
        ...SLOT_ROLES.map((r) => el("option", { value: r, textContent: r })));
      slot.value = p.slot ?? "";
      return el("div", {},
        el("span", { textContent: p.connected ? "● " : "○ ", title: p.connected ? "online" : "offline" }),
        nick, " ", slot, " ", el("button", { textContent: "Remove", onclick: () => remove(uid) }),
        p.isBot ? " (bot)" : "");
    }));
  }

  onValue(ref(db, `${base}/meta`), (s) => {
    meta = s.val();
    if (meta) sceneSel.value = meta.sceneId;
    loaded.add("meta");
  });
  onValue(ref(db, `${base}/round`), (s) => {
    const r = s.val() as Round | null;
    if (r && round && r.statusVersion < round.statusVersion) return; // stale callback (ROUND_STATE_MACHINE §5)
    round = r;
    if (round) durSel.value = String(round.durationMs);
    loaded.add("round");
    renderPlayers();
  });
  onValue(ref(db, `${base}/players`), (s) => {
    players = s.val() ?? {};
    loaded.add("players");
    renderPlayers();
  });
  onValue(ref(db, `${base}/choices`), (s) => { choices = s.val() ?? {}; loaded.add("choices"); });
  onValue(ref(db, `${base}/ratings`), (s) => { ratings = s.val() ?? {}; loaded.add("ratings"); });
  onValue(ref(db, `${base}/results`), (s) => { results = s.val() ?? {}; loaded.add("results"); });
}

start().catch((e) => (app.textContent = `error: ${e.message}`));
