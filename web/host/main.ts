import { get } from "firebase/database";
import QRCode from "qrcode";
import { DEFAULT_DURATION_MS, DURATIONS_MS, NICK_MAX, NICK_MIN, SESSION_CODE_ALPHABET, SESSION_CODE_LEN } from "../../shared/contracts";
import type { Player, Role, Round, SessionMeta } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { db, onValue, ref, serverTimestamp, set, signIn, update } from "../lib/firebase";

// B2: lobby only (create session, QR, scene, duration, players, slots, bots). State machine is B4 (D-10).
// Solo scope (BUILD_ORDER §8): only three assignable roles; texture/mood stay neutral.
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

/** T1: create session + lobby round. Sequential: round's rule reads meta.hostUid from the stored tree. */
async function createSession(uid: string) {
  let code = newCode();
  while ((await get(ref(db, `sessions/${code}/meta`))).exists()) code = newCode();
  const sceneId = BUNDLED_SCENES[0].id;
  await set(ref(db, `sessions/${code}/meta`), { hostUid: uid, sceneId, createdAt: serverTimestamp(), roundCounter: 0 });
  await set(ref(db, `sessions/${code}/round`), { id: "r0", sceneId, status: "lobby", durationMs: DEFAULT_DURATION_MS, statusVersion: 0 });
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

  const canvas = el("canvas");
  QRCode.toCanvas(canvas, playUrl, { width: 240 });
  const sceneSel = el("select", { onchange: () => {
    const sceneId = sceneSel.value;
    update(ref(db, base), { "meta/sceneId": sceneId, "round/sceneId": sceneId });
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

  app.replaceChildren(
    el("h1", { textContent: `Host — ${code}` }),
    canvas,
    el("div", {}, el("a", { href: playUrl, textContent: playUrl })),
    el("p", {}, "Scene ", sceneSel, " Duration ", durSel),
    el("p", {}, el("button", { textContent: "Add 3 bots", onclick: () => addBots(3) }), " ", newBtn),
    count,
    list,
  );

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
    const m = s.val() as SessionMeta | null;
    if (m) sceneSel.value = m.sceneId;
  });
  onValue(ref(db, `${base}/round`), (s) => {
    round = s.val();
    if (round) durSel.value = String(round.durationMs);
    renderPlayers();
  });
  onValue(ref(db, `${base}/players`), (s) => {
    players = s.val() ?? {};
    renderPlayers();
  });
}

start().catch((e) => (app.textContent = `error: ${e.message}`));
