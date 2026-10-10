import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deleteApp, initializeApp, setLogLevel, type FirebaseApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase, push, ref, serverTimestamp, set, update } from "firebase/database";

// B6: database.rules.json against the RTDB emulator (needs Java). Run:
//   firebase emulators:exec --only database "npx tsx database.rules.test.ts"
const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000";
const NS = "rules-test";
setLogLevel("error"); // every denied write would otherwise print a warning
const S = "sessions/ABCD";

/** Emulator "owner" REST call: bypasses rules, used for setup only. */
async function admin(method: string, path: string, body: unknown) {
  const r = await fetch(`http://${HOST}/${path}.json?ns=${NS}`, {
    method, headers: { Authorization: "Bearer owner" }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
}

const apps: FirebaseApp[] = [];
function as(uid: string) {
  const app = initializeApp({ databaseURL: `https://${NS}.firebaseio.com`, projectId: "demo-murmuration" }, uid);
  apps.push(app);
  const db = getDatabase(app);
  const [h, p] = HOST.split(":");
  connectDatabaseEmulator(db, h, Number(p), { mockUserToken: { user_id: uid } });
  return db;
}

let n = 0;
const ok = async (label: string, p: Promise<unknown>) => {
  await p.catch((e) => assert.fail(`${label}: expected allow, got ${e.message}`));
  n++;
};
const denied = async (label: string, p: Promise<unknown>) => {
  await assert.rejects(p, /permission_denied/i, `${label}: expected deny`);
  n++;
};

await admin("PUT", ".settings/rules", readFileSync(new URL("./database.rules.json", import.meta.url), "utf8"));
const now = Date.now();
await admin("PUT", S, {
  meta: { hostUid: "host", screenUid: "screen", sceneId: "rush-hour", createdAt: now, roundCounter: 1 },
  players: {
    alice: { nick: "Alice", joinedAt: now, role: "creator", slot: "palette", queuePos: 1 },
    bob: { nick: "Bob", joinedAt: now, role: "spectator", queuePos: 2 },
    carol: { nick: "Carol", joinedAt: now, role: "spectator", queuePos: 3, removed: true },
    bot_1: { nick: "Bot 1", joinedAt: now, role: "creator", slot: "form", queuePos: 4, isBot: true },
  },
  round: { id: "r1", sceneId: "rush-hour", status: "live", durationMs: 60000, statusVersion: 1, seed: 7, startsAt: now - 1000, slots: { palette: "alice", form: "bot_1" } },
});
const [host, alice, bob, carol, dave, screen] = ["host", "alice", "bob", "carol", "dave", "screen"].map(as);
const choice = (optionId: string, uid: string) => ({ optionId, uid, at: serverTimestamp() });
const tap = (db: ReturnType<typeof as>, role: string, uid: string) =>
  update(ref(db, S), { [`choices/${role}`]: choice("pal-x", uid), [`events/${push(ref(db, `${S}/events`)).key}`]: { t: 1000, role, optionId: "pal-x", uid } });

// Players: own record and own nick only; host-only fields stay host-only.
await ok("join with /play payload", set(ref(dave, `${S}/players/dave`), { nick: "Dave", joinedAt: serverTimestamp(), connected: true, lastSeen: serverTimestamp(), role: "spectator", queuePos: serverTimestamp() }));
await denied("create someone else's player", set(ref(dave, `${S}/players/eve`), { nick: "Eve", role: "spectator" }));
await ok("rename own nick", set(ref(bob, `${S}/players/bob/nick`), "Bobby"));
await denied("rename another player", set(ref(bob, `${S}/players/alice/nick`), "lol"));
await denied("self-assign a slot", set(ref(bob, `${S}/players/bob/slot`), "motion"));
await denied("removed player renames", set(ref(carol, `${S}/players/carol/nick`), "Back"));
await ok("host renames a player", set(ref(host, `${S}/players/bob/nick`), "Rob"));

// Host-only state.
await denied("phone writes round status", set(ref(alice, `${S}/round/status`), "reveal"));
await denied("phone hijacks hostUid", set(ref(bob, `${S}/meta/hostUid`), "bob"));
await denied("phone writes author score", set(ref(bob, `${S}/results/author`), { score: 10, perRole: {} }));
await denied("phone writes flags", set(ref(bob, "config/flags/aiEnabled"), true));

// Choices: slot owner only, own uid, inside the live window; events append-only.
await ok("slot owner taps (choice + event)", tap(alice, "palette", "alice"));
await denied("non-owner writes the role", tap(bob, "palette", "bob"));
await denied("owner writes another role", tap(alice, "form", "alice"));
await denied("owner spoofs uid", set(ref(alice, `${S}/choices/palette`), choice("pal-x", "bob")));
const ev = push(ref(alice, `${S}/events`)).key;
await ok("append an event", set(ref(alice, `${S}/events/${ev}`), { t: 2000, role: "palette", optionId: "pal-x", uid: "alice" }));
await denied("overwrite an event", set(ref(alice, `${S}/events/${ev}`), { t: 3000, role: "palette", optionId: "pal-y", uid: "alice" }));
await ok("host writes a bot choice", tap(host, "form", "bot_1"));
await ok("host moves the clock past the end", set(ref(host, `${S}/round/startsAt`), Date.now() - 61000));
await denied("owner taps after the window", tap(alice, "palette", "alice"));

// Ratings: spectators only, once, 1..5, inside status rating + ratingEndsAt + 3 s.
await denied("rate before rating opens", set(ref(bob, `${S}/ratings/bob`), 4));
// startsAt moved back so only the status blocks the next tap.
await ok("host enters rating", update(ref(host, `${S}/round`), { status: "rating", startsAt: Date.now(), lockedAt: Date.now() - 1500, ratingEndsAt: Date.now() + 12000, statusVersion: 3 }));
await denied("owner taps when not live", tap(alice, "palette", "alice"));
await ok("spectator rates", set(ref(bob, `${S}/ratings/bob`), 4));
await denied("spectator rates twice", set(ref(bob, `${S}/ratings/bob`), 5));
await denied("creator rates", set(ref(alice, `${S}/ratings/alice`), 5));
await denied("rate for someone else", set(ref(bob, `${S}/ratings/dave`), 1));
await denied("rating out of range", set(ref(dave, `${S}/ratings/dave`), 6));
await denied("rating not an integer", set(ref(dave, `${S}/ratings/dave`), 2.5));
await denied("removed player rates", set(ref(carol, `${S}/ratings/carol`), 3));
await ok("host writes a bot rating", set(ref(host, `${S}/ratings/bot_9`), 3));
await ok("host closes the window", set(ref(host, `${S}/round/ratingEndsAt`), Date.now() - 4000));
await denied("rate after window + grace", set(ref(dave, `${S}/ratings/dave`), 3));

// Results: judge marker once by screen; function-only fields closed to clients.
await ok("screen marks judge requested", set(ref(screen, `${S}/results/judgeRequestedAt`), serverTimestamp()));
await denied("judge marker twice", set(ref(screen, `${S}/results/judgeRequestedAt`), serverTimestamp()));
await denied("host writes AI score", set(ref(host, `${S}/results/ai`), { score: 10, comment: "", model: "x", fallback: false }));

await Promise.all(apps.map((a) => deleteApp(a)));
console.log(`database.rules.test ok (${n} assertions)`);
process.exit(0);
