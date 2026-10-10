import { get, push } from "firebase/database";
import type { Choices, Player, Role, Round } from "../../shared/contracts";
import { NICK_MAX } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { db, onValue, ref, serverNow, serverTimestamp, set, signIn, trackPresence, update } from "../lib/firebase";
import { cleanNick } from "../lib/nick";

// B3: join (optional nick), Spectator waiting, Creator dial (4 buttons for own role). Never writes round state (D-10).
// Rating UI is P1-3; Spectators just wait here.
const app = document.querySelector<HTMLElement>("#app")!;
document.body.style.cssText = "margin:0;background:#14110f;color:#F4EFE6;font:500 18px system-ui,sans-serif";
app.style.cssText = "padding:20px;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:12px";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
const BTN = "min-height:72px;font:600 22px system-ui,sans-serif;border-radius:12px;border:2px solid #4a443d;background:#2a2622;color:#F4EFE6";
const buzz = (p: number | number[]) => navigator.vibrate?.(p);

const code = (new URLSearchParams(location.search).get("s") ?? "").toUpperCase();
const base = `sessions/${code}`;

signIn().then(async (uid) => {
  if (!code || !(await get(ref(db, `${base}/meta`))).exists()) throw new Error("Session not found. Scan the QR again.");
  if ((await get(ref(db, `${base}/players/${uid}`))).exists()) return run(uid);
  const input = el("input", { placeholder: "Nickname (optional)", maxLength: NICK_MAX });
  input.style.cssText = "min-height:56px;font-size:20px;padding:0 12px;border-radius:12px";
  const join = el("button", { textContent: "Join", onclick: async () => {
    join.disabled = true;
    await set(ref(db, `${base}/players/${uid}`), {
      nick: cleanNick(input.value, uid), joinedAt: serverTimestamp(), connected: true, lastSeen: serverTimestamp(),
      role: "spectator", queuePos: serverTimestamp(),
    });
    run(uid);
  } });
  join.style.cssText = BTN;
  app.replaceChildren(el("h1", { textContent: `Join ${code}` }), input, join);
}).catch((e) => (app.textContent = `error: ${e.message}`));

function run(uid: string) {
  trackPresence(code, uid);
  let round: Round | null = null;
  let me: Player | null = null;
  let choices: Choices = {};
  let shownKey = ""; // re-render only when the visible state changes
  const count = el("div");
  count.style.cssText = "font:700 48px system-ui,sans-serif;font-variant-numeric:tabular-nums";

  // Slot truth is round.slots (host-written); the phone only reads it.
  const myRole = (): Role | null => (round?.slots ? (Object.keys(round.slots) as Role[]).find((r) => round!.slots![r] === uid) ?? null : null);
  const endsAt = () => (round?.startsAt ? round.startsAt + round.durationMs : 0);

  function pick(role: Role, optionId: string) {
    const t = Math.min(round!.durationMs, Math.max(0, serverNow() - round!.startsAt!));
    const key = push(ref(db, `${base}/events`)).key!;
    update(ref(db, base), {
      [`choices/${role}`]: { optionId, uid, at: serverTimestamp() },
      [`events/${key}`]: { t, role, optionId, uid },
    }).then(() => buzz(30), () => buzz([60, 40, 60]));
  }

  function render() {
    if (!round || !me) return;
    const role = myRole();
    const scene = BUNDLED_SCENES.find((s) => s.id === round!.sceneId);
    const live = round.status === "live" && !!round.startsAt && serverNow() < endsAt();
    const mine = role ? choices[role]?.optionId : undefined;
    const key = [me.removed, me.nick, role, round.id, round.status, mine, live].join("|");
    if (key === shownKey) return;
    const prevRole = shownKey.split("|")[2];
    const prevStatus = shownKey.split("|")[4];
    shownKey = key;
    if (role && prevRole !== role) buzz([40, 60, 40]);
    if (round.status === "locked" && prevStatus !== "locked") buzz(60);

    if (me.removed) return void app.replaceChildren(el("h1", { textContent: "Removed by host" }));
    const head = el("div", {}, el("div", { textContent: me.nick }), el("h1", { textContent: role ? `You are the ${role[0].toUpperCase()}${role.slice(1)}` : "You're a Spectator" }));
    if (!role || !scene) {
      const msg = round.status === "lobby" ? "Waiting for the round to start." : round.status === "live" ? "Watch the big screen." : round.status === "locked" ? "Locked, get ready to rate." : "Look at the big screen.";
      return void app.replaceChildren(head, el("p", { textContent: msg }));
    }
    const buttons = scene.options[role].map((o) => {
      const b = el("button", { textContent: o.label, disabled: !live, onclick: () => pick(role, o.id) });
      b.style.cssText = `${BTN};${o.id === mine ? "border-color:#FFB45A;background:#4a3a22;" : ""}${live ? "" : "opacity:.5;"}`;
      return b;
    });
    const note = round.status === "lobby" ? "Waiting for the round to start." : live ? round.promptText ?? "" : "Locked.";
    app.replaceChildren(head, count, el("p", { textContent: note }), ...(round.status === "lobby" ? [] : buttons));
  }

  onValue(ref(db, `${base}/round`), (s) => { round = s.val(); render(); });
  onValue(ref(db, `${base}/players/${uid}`), (s) => { me = s.val(); render(); });
  onValue(ref(db, `${base}/choices`), (s) => { choices = s.val() ?? {}; render(); });
  setInterval(() => {
    const left = round?.status === "live" && round.startsAt ? Math.max(0, endsAt() - serverNow()) : 0;
    count.textContent = round?.status === "live" ? `${Math.floor(left / 60000)}:${String(Math.ceil(left / 1000) % 60).padStart(2, "0")}` : "";
    render(); // catches the live→timeout flip without a DB event
  }, 250);
}
