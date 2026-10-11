import "../lib/chrome/ui.css";
import "../lib/chrome/instrument.css";
import { get, push } from "firebase/database";
import type { Choices, Player, Results, Role, Round } from "../../shared/contracts";
import { ENERGY_WRITE_THROTTLE_MS, NICK_MAX } from "../../shared/contracts";
import { BUNDLED_SCENES } from "../../shared/sceneLoader";
import { mountBoids } from "../lib/chrome/boids";
import { icon } from "../lib/chrome/icons";
import { markEl } from "../lib/chrome/mark";
import { downloadUrl } from "../lib/download";
import { db, onValue, ref, serverNow, serverTimestamp, set, signIn, trackPresence, update } from "../lib/firebase";
import { cleanNick } from "../lib/nick";

// B3: join (optional nick), Spectator waiting, Creator dial (4 buttons for own role). Never writes round state (D-10).
// P1-3: Spectators rate 1–5 once in the rating window; Creators see a "You made this" card.
// UI v2 (art direction §12): the phone is an instrument. Styles live in index.html + lib/chrome/ui.css; this file only sets class names.
// Every Firebase read/write, listener, timer and transition below is unchanged from v1.
const app = document.querySelector<HTMLElement>("#app")!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
const buzz = (p: number | number[]) => navigator.vibrate?.(p);
const capitalize = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const SCORES_DELAY_MS = 2600; // phones list scores after the big screen has stamped them (matches /screen credits delay)
const KEY_H = 72, KEY_GAP = 12; // option key height + gap, for the needle
// One node reused by every waiting view, so re-renders move it instead of restarting the flock.
const flock = el("canvas", { className: "flock" });
flock.setAttribute("aria-hidden", "true");
mountBoids(flock, { count: 64, seed: 3, alpha: 0.3, mode: { kind: "roam", home: { x: 0.08, y: 0.1, w: 0.84, h: 0.8 } } });
const brand = () => el("div", { className: "brand" }, markEl(28), el("span", { className: "word", textContent: "Murmuration" }));
const dots = () => el("div", { className: "dots" }, el("i"), el("i"), el("i"));

const code = (new URLSearchParams(location.search).get("s") ?? "").toUpperCase();
const base = `sessions/${code}`;

signIn().then(async (uid) => {
  if (!code || !(await get(ref(db, `${base}/meta`))).exists()) throw new Error("Session not found. Scan the QR on the big screen again, or check the code.");
  if ((await get(ref(db, `${base}/players/${uid}`))).exists()) return run(uid);
  const input = el("input", { placeholder: "Nickname (optional)", maxLength: NICK_MAX, className: "field", autocomplete: "off" });
  input.setAttribute("aria-label", "Nickname");
  const join = el("button", { textContent: "Join", className: "primary", onclick: async () => {
    join.disabled = true;
    await set(ref(db, `${base}/players/${uid}`), {
      nick: cleanNick(input.value, uid), joinedAt: serverTimestamp(), connected: true, lastSeen: serverTimestamp(),
      role: "spectator", queuePos: serverTimestamp(),
    });
    run(uid);
  } });
  app.replaceChildren(
    flock,
    brand(),
    el("div", { className: "code" }, "Session", el("b", { textContent: code })),
    el("p", { className: "pitch", textContent: "Three people, three dials, one artwork." }),
    el("p", { textContent: "Pick a nickname, or join without one. It shows on the big screen next to your dial." }),
    el("div", { className: "actions" }, input, join),
  );
  stagger();
  app.classList.add("enter");
}).catch((e) => {
  app.replaceChildren(
    brand(),
    el("h1", { textContent: "Can't join" }),
    el("p", { textContent: e.message }),
    el("div", { className: "actions" }, el("a", { className: "secondary", href: "/", textContent: "Back to start" })),
  );
  stagger();
  app.classList.add("enter");
});

/** Children wave in: --i drives the enter stagger (ui.css). */
function stagger() {
  [...app.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(Math.min(i, 7))));
}

function run(uid: string) {
  trackPresence(code, uid);
  let round: Round | null = null;
  let me: Player | null = null;
  let choices: Choices = {};
  let online = true;
  let rated: number | null = null; // own ratings/{uid} only; phones never listen to all ratings
  let results: Results = {};
  let shownKey = ""; // re-render only when the visible state changes (selection is patched in place)
  let shownView = ""; // screen identity; a change plays the enter transition
  let stamped = ""; // round id whose rating buttons already stamped in
  let revealAt = 0; // performance.now() when this phone saw reveal
  let needleAt = -1; // key index the needle last rested on (for the slide)
  let lastMine = ""; // last optionId painted on the keys (empty = none)
  let keysWrap: HTMLElement | null = null;
  let needleEl: HTMLElement | null = null;
  let keyButtons: HTMLButtonElement[] = [];
  let keyOptions: { id: string; label: string }[] = [];
  const banner = el("div", { className: "banner" }, el("i"), "Reconnecting…");
  const count = el("div", { className: "count" });
  const railFill = el("i");
  const rail = el("div", { className: "rail" }, railFill);

  // Slot truth is round.slots (host-written); the phone only reads it.
  const myRole = (): Role | null => (round?.slots ? (Object.keys(round.slots) as Role[]).find((r) => round!.slots![r] === uid) ?? null : null);
  const endsAt = () => (round?.startsAt ? round.startsAt + round.durationMs : 0);

  function pick(role: Role, optionId: string) {
    if (choices[role]?.optionId === optionId) return;
    // Paint immediately; Firebase confirm only patches if the optionId actually changed.
    choices = { ...choices, [role]: { optionId, uid, at: serverNow() } };
    syncKeys(optionId, true);
    const t = Math.min(round!.durationMs, Math.max(0, serverNow() - round!.startsAt!));
    const key = push(ref(db, `${base}/events`)).key!;
    update(ref(db, base), {
      [`choices/${role}`]: { optionId, uid, at: serverTimestamp() },
      [`events/${key}`]: { t, role, optionId, uid },
    }).then(() => buzz(30), () => buzz([60, 40, 60]));
  }

  function rate(n: number) {
    set(ref(db, `${base}/ratings/${uid}`), n).then(() => buzz(30), () => buzz([60, 40, 60]));
  }

  // P2 energy: trailing throttle, at most one write per ENERGY_WRITE_THROTTLE_MS; value resets with each round (host clears the node).
  let energyVal = 50, energyRound = "", energyTimer = 0, energyLast = 0;
  function sendEnergy() {
    if (energyTimer) return;
    energyTimer = window.setTimeout(() => {
      energyTimer = 0;
      energyLast = performance.now();
      set(ref(db, `${base}/energy/${uid}`), energyVal).catch(() => {});
    }, Math.max(0, energyLast + ENERGY_WRITE_THROTTLE_MS - performance.now()));
  }
  function energyDial(on: boolean) {
    const input = el("input", { type: "range", min: "0", max: "100", step: "1", value: String(energyVal), disabled: !on });
    input.setAttribute("aria-label", "Energy");
    input.oninput = () => { energyVal = input.valueAsNumber; sendEnergy(); };
    return el("div", {}, el("div", { className: "caps", textContent: "Energy" }), el("p", { className: "hint", textContent: "Everyone's dial blends into how fast the scene moves." }), input,
      el("div", { className: "scale hint" }, el("span", { textContent: "Calm" }), el("span", { textContent: "Lively" })));
  }

  const fmt = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(1));
  /** Beat 9: three scores + combined; null scores show an em dash and a caption, never an empty row. */
  function scoreList() {
    const row = (label: string, v: number | null | undefined, note: string, cls = "") =>
      el("div", { className: `sc ${cls}` }, el("span", { className: "caps", textContent: label }), el("span", { className: "num", textContent: fmt(v) }),
        ...(note ? [el("span", { className: "hint", textContent: note })] : []));
    const wait = Math.max(0, revealAt + SCORES_DELAY_MS - performance.now());
    const done = el("div", { className: wait > 0 ? "scores later" : "scores" },
      row("Author's Taste", results.author?.score, results.author ? "" : "no picks"),
      row("AI Match", results.ai?.score, results.ai ? (results.ai.fallback ? "offline judge" : "") : "judge offline"),
      row("Audience", results.audience?.score, results.audience?.count ? `from ${results.audience.count} rating${results.audience.count === 1 ? "" : "s"}` : "no ratings"),
      row("Combined", results.combined, "", "total"));
    done.style.setProperty("--d", `${wait}ms`);
    return done;
  }
  const nextSoon = () => el("p", { className: "hint", textContent: "Next round soon" });

  /** Storage URLs only — no Gemini call. Buttons appear as each URL lands. */
  function dlButtons() {
    if (round?.status !== "reveal") return [];
    const id = round.id;
    const out: HTMLElement[] = [];
    if (results.snapshotUrl) {
      out.push(el("button", { textContent: "Download artwork", className: "secondary", onclick: () => downloadUrl(results.snapshotUrl!, `murmuration-${code}-${id}.jpg`) }));
    }
    if (results.reimagined?.url) {
      out.push(el("button", { textContent: "Download Gemini image", className: "secondary", onclick: () => downloadUrl(results.reimagined!.url!, `murmuration-${code}-${id}-gemini.png`) }));
    }
    return out;
  }

  /** Move the needle + .on class without rebuilding the page (avoids a full-DOM jolt on each pick). */
  function syncKeys(mine: string | undefined, on: boolean) {
    if (!keysWrap || !needleEl) return;
    const at = keyOptions.findIndex((o) => o.id === mine);
    keysWrap.classList.toggle("has", at >= 0);
    keyButtons.forEach((b, i) => {
      b.classList.toggle("on", keyOptions[i]?.id === mine);
      b.disabled = !on;
    });
    if (at >= 0) {
      const y = (i: number) => `translateY(${i * (KEY_H + KEY_GAP)}px)`;
      const from = needleAt >= 0 ? needleAt : at;
      needleEl.style.transform = y(at);
      if (from !== at && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        needleEl.animate([{ transform: y(from) }, { transform: y(at) }], { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    needleAt = at;
    lastMine = mine ?? "";
  }

  /** Four option keys on the detent rail; the needle slides (WAAPI, transform only) from where it last rested. */
  function keys(role: Role, options: { id: string; label: string }[], mine: string | undefined, on: boolean) {
    const needle = el("i", { className: "needle" });
    const buttons = options.map((o, i) => el("button", { className: o.id === mine ? "key on" : "key", disabled: !on, onclick: () => pick(role, o.id) },
      el("span", { textContent: o.label }), el("small", { textContent: `0${i + 1}` })));
    const wrap = el("div", { className: "keys" }, needle, ...buttons);
    keysWrap = wrap;
    needleEl = needle;
    keyButtons = buttons;
    keyOptions = options;
    syncKeys(mine, on);
    return wrap;
  }

  function render() {
    if (!round || !me) return;
    if (energyRound !== round.id) { energyRound = round.id; energyVal = 50; clearTimeout(energyTimer); energyTimer = 0; }
    const role = myRole();
    const scene = BUNDLED_SCENES.find((s) => s.id === round!.sceneId);
    const live = round.status === "live" && !!round.startsAt && serverNow() < endsAt();
    const mine = role ? choices[role]?.optionId : undefined;
    const scores = round.status === "reveal" ? [results.author?.score, results.ai?.score, results.ai?.fallback, results.audience?.score, results.audience?.count, results.combined] : [];
    // Selection (`mine`) is patched onto the keys in place — keep it out of the structural key so picks don't replaceChildren.
    const key = [me.removed, me.nick, role, round.id, round.status, live, online, rated, results.snapshotUrl ?? "", results.reimagined?.url ?? "", ...scores].join("|");
    if (key === shownKey) {
      if ((mine ?? "") !== lastMine) syncKeys(mine, live && online);
      return;
    }
    const prevRole = shownKey.split("|")[2];
    const prevStatus = shownKey.split("|")[4];
    shownKey = key;
    if (role && prevRole !== role) buzz([40, 60, 40]);
    if (round.status === "locked" && prevStatus !== "locked") buzz(60);
    if (round.status === "reveal" && prevStatus !== "reveal") revealAt = performance.now() - (prevStatus === undefined ? SCORES_DELAY_MS : 0); // reload in reveal: no wait

    const view = [me.removed, role, round.id, round.status, live].join("|");
    const fresh = view !== shownView;
    shownView = view;
    if (fresh) needleAt = -1;
    const show = (...kids: Node[]) => {
      app.replaceChildren(...kids);
      if (!fresh) return;
      stagger();
      app.classList.remove("enter");
      void app.offsetWidth; // restart the enter animation
      app.classList.add("enter");
    };

    if (me.removed) return void show(brand(), el("h1", { textContent: "Removed by host" }), el("p", { textContent: "The host took this phone out of the session. Nothing else to do here." }));
    const badge = el("span", { className: "badge" }, ...(role ? [el("i", { className: "dot" })] : []), role ?? "Spectator");
    if (role) badge.style.setProperty("--hue", `var(--role-${role})`);
    const who = online ? el("div", { className: "who" }, el("i", { className: "dot ok" }), el("b", { textContent: me.nick }), el("span", { textContent: `· session ${code}` })) : banner;
    const head = (text: string, glyph?: HTMLElement) =>
      el("div", { className: "head" }, el("div", { className: "top" }, badge, count), rail, who, el("h1", {}, text, ...(glyph ? [glyph] : [])));
    if (round.status === "rating" && !role) { // D-14: five write-once buttons; rules enforce once/window/Spectator
      const row = el("div", { className: stamped !== round.id && rated == null ? "rate stamp" : "rate" });
      stamped = round.id;
      for (let n = 1; n <= 5; n++) {
        const b = el("button", { textContent: String(n), disabled: !online || rated != null, className: rated === n ? "on" : rated != null ? "dim" : "", onclick: () => rate(n) });
        b.style.setProperty("--i", String(n - 1));
        row.append(b);
      }
      return void show(
        rated != null ? head("Thanks", icon("check", "ok")) : head("Rate it"),
        el("p", { textContent: rated != null ? "Scores land on the big screen in a moment." : "How did the room do? One tap, one vote." }),
        el("div", { className: "actions" }, row, el("div", { className: "scale hint" }, el("span", { textContent: "1 low" }), el("span", { textContent: "5 high" }))),
      );
    }
    if ((round.status === "rating" || round.status === "reveal") && role && scene) { // Creators don't rate (D-14)
      const label = scene.options[role].find((o) => o.id === mine)?.label ?? "No pick";
      const reveal = round.status === "reveal";
      const card = el("div", { className: "card" }, badge, el("h1", { textContent: "You made this" }),
        el("div", {}, el("div", { className: "caps", textContent: "Your pick" }), el("div", { className: "pick", textContent: label })),
        ...(reveal ? [] : [el("p", { className: "hint", textContent: "The room is rating. Scores on the big screen." })]));
      card.style.setProperty("--hue", `var(--role-${role})`);
      return void show(...(online ? [] : [banner]), card, el("div", { className: "actions" }, ...(reveal ? [scoreList()] : []), ...dlButtons(), ...(reveal ? [nextSoon()] : [])));
    }
    if (!role || !scene) {
      const s = round.status;
      const flockView = s === "lobby" && !role;
      const msg = flockView ? "You're watching. Three Creators turn the dials on the big screen; you rate what they make."
        : s === "lobby" ? "Waiting for the host to start the round." : s === "live" ? "Watch the big screen." : s === "locked" ? "Get ready to rate." : "Look at the big screen.";
      // P2 energy dial (D-08): Spectators only, during live.
      const dial = s === "live" && !role ? [energyDial(live && online)] : [];
      const h = s === "locked" ? head("Locked", icon("lock")) : head(role ? `You are the ${capitalize(role)}` : flockView ? "You're in the flock" : "You're a Spectator");
      return void show(...(s === "lobby" ? [flock] : []), h, el("p", { textContent: msg }), ...(s === "lobby" ? [dots()] : []),
        el("div", { className: "actions" }, ...(s === "reveal" ? [scoreList()] : []), ...dial, ...dlButtons(), ...(s === "reveal" ? [nextSoon()] : []),
          ...(s === "lobby" && !role ? [el("p", { className: "hint", textContent: "When the round locks, five keys appear here. One tap." })] : [])));
    }
    const on = live && online;
    const lobby = round.status === "lobby";
    const note = lobby ? "Waiting for the host to start the round. Your four options appear here." : round.promptText ?? "";
    show(...(lobby ? [flock] : []), lobby || live ? head(`You are the ${capitalize(role)}`) : head("Locked", icon("lock")), el("p", { className: lobby ? "" : "prompt", textContent: note }),
      ...(lobby
        ? [dots(), el("div", { className: "actions" }, el("p", { className: "hint", textContent: "One dial is yours. The other two belong to someone else in the room." }))]
        : [el("div", { className: "actions" }, keys(role, scene.options[role], mine, on))]));
  }

  onValue(ref(db, ".info/connected"), (s) => { online = s.val() === true; render(); });
  onValue(ref(db, `${base}/round`), (s) => { round = s.val(); render(); });
  onValue(ref(db, `${base}/players/${uid}`), (s) => { me = s.val(); render(); });
  onValue(ref(db, `${base}/ratings/${uid}`), (s) => { rated = s.val(); render(); });
  onValue(ref(db, `${base}/choices`), (s) => { choices = s.val() ?? {}; render(); });
  onValue(ref(db, `${base}/results`), (s) => { results = s.val() ?? {}; render(); });
  setInterval(() => {
    const live = round?.status === "live" && !!round.startsAt;
    const left = live ? Math.max(0, endsAt() - serverNow()) : 0;
    const s = Math.ceil(left / 1000);
    count.textContent = round?.status === "live" ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
    count.classList.toggle("urgent", round?.status === "live" && s <= 10); // §6.0: color + 1 Hz pulse, never color alone
    rail.classList.toggle("live", live);
    rail.classList.toggle("urgent", live && s <= 10);
    railFill.style.setProperty("--f", live ? (left / round!.durationMs).toFixed(4) : "0"); // same server-timed number as the numeral
    render(); // catches the live→timeout flip without a DB event
  }, 250);
}
