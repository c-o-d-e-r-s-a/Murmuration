import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";

// Web config is public by design (not a secret); access is enforced by rules.
const firebaseConfig = {
  apiKey: "AIzaSyB8-dV_JfIfU_9kbhrOHdsVfE4gEz6Cy78",
  authDomain: "murmuration-33d60.firebaseapp.com",
  databaseURL: "https://murmuration-33d60-default-rtdb.firebaseio.com",
  projectId: "murmuration-33d60",
  storageBucket: "murmuration-33d60.firebasestorage.app",
  messagingSenderId: "327552959609",
  appId: "1:327552959609:web:f1f6375c6ed1a2ae5740a8",
  measurementId: "G-ZMPJNMSC4F",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const functions = getFunctions(app);

// Offset between server and local clock; stays 0 until .info/serverTimeOffset reports.
let offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), (s) => (offset = s.val() ?? 0));

/** Server epoch ms (CONTRACTS §time). */
export const serverNow = () => Date.now() + offset;

/** Anonymous sign-in; resolves to the uid (same uid on reload). */
export async function signIn(): Promise<string> {
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser!.uid;
}

/**
 * Presence for players/{uid} (record must already exist with a nick, per rules):
 * register onDisconnect first, then mark online,
 * re-running on every reconnect. Touches only connected + lastSeen. Returns unsubscribe.
 */
export function trackPresence(code: string, uid: string) {
  const me = ref(db, `sessions/${code}/players/${uid}`);
  return onValue(ref(db, ".info/connected"), async (s) => {
    if (s.val() !== true) return;
    await onDisconnect(me).update({ connected: false, lastSeen: serverTimestamp() });
    await update(me, { connected: true, lastSeen: serverTimestamp() });
  });
}

export { ref, onValue, set, update, serverTimestamp, runTransaction, httpsCallable };
