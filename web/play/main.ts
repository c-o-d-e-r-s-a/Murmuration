import { get } from "firebase/database";
import { db, onValue, ref, serverTimestamp, set, signIn, trackPresence } from "../lib/firebase";

// B1 smoke only (replaced by B2/B3): /play?s=TEST creates the session if missing
// (first tab becomes its host), joins with a nick, then lists players online/offline.
const app = document.querySelector<HTMLElement>("#app")!;
app.style.whiteSpace = "pre";
const code = new URLSearchParams(location.search).get("s") ?? "TEST";
const base = `sessions/${code}`;

signIn()
  .then(async (uid) => {
    if (!(await get(ref(db, `${base}/meta`))).exists())
      await set(ref(db, `${base}/meta`), { hostUid: uid, createdAt: serverTimestamp() });
    if (!(await get(ref(db, `${base}/players/${uid}`))).exists())
      await set(ref(db, `${base}/players/${uid}`), {
        nick: `Guest-${uid.slice(0, 4)}`,
        joinedAt: serverTimestamp(),
        connected: true,
        lastSeen: serverTimestamp(),
      });
    trackPresence(code, uid);
    onValue(ref(db, `${base}/players`), (s) => {
      const p = s.val() ?? {};
      app.textContent = Object.keys(p)
        .map((u) => `${p[u].nick}${u === uid ? " (me)" : ""}: ${p[u].connected ? "online" : "offline"}`)
        .join("\n");
    });
  })
  .catch((e) => (app.textContent = `error: ${e.message}`));
