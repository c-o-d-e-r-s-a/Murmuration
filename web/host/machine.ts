// B4 pure helpers for the round state machine (ROUND_STATE_MACHINE §2). No Firebase/DOM; self-check in machine.test.ts.
import { RATING_MAX_MS, SETTLE_MS } from "../../shared/contracts";
import type { Prompt, Round, Scene } from "../../shared/contracts";

/** Latest ratingEndsAt allowed (T5 hard cap). */
export const ratingCap = (round: Round) => (round.lockedAt ?? 0) + SETTLE_MS + RATING_MAX_MS;

/** Timer-driven step due at `now`: T3 lock, T4 settle, T5 reveal, or "extend" the rating window while the verdict isn't ready. */
export function due(round: Round, now: number, verdictReady: boolean): "T3" | "T4" | "T5" | "extend" | null {
  if (round.status === "live" && round.startsAt != null && now >= round.startsAt + round.durationMs) return "T3";
  if (round.status === "locked" && round.lockedAt != null && now >= round.lockedAt + SETTLE_MS) return "T4";
  if (round.status === "rating" && round.ratingEndsAt != null && now >= round.ratingEndsAt) {
    return !verdictReady && now < ratingCap(round) ? "extend" : "T5";
  }
  return null;
}

/**
 * Random prompt not yet used (keys `${sceneId}:${promptId}`), never `except`.
 * If every other prompt is used, draws from all of them and sets `reset` so the caller clears the scene's used flags.
 */
export function drawPrompt(scene: Scene, used: Record<string, true> | undefined, except: string | null, rand = Math.random): { prompt: Prompt | null; reset: boolean } {
  const pool = scene.prompts.filter((p) => p.id !== except);
  const fresh = pool.filter((p) => !used?.[`${scene.id}:${p.id}`]);
  const from = fresh.length ? fresh : pool;
  return { prompt: from.length ? from[Math.floor(rand() * from.length)] : null, reset: !fresh.length };
}

type Rotating = { queuePos: number; isBot?: boolean; removed?: boolean };

/**
 * T6 rotation (ROUND_STATE_MACHINE §4, D-12), solo: current Creators go to the back in slot order (max+1..), then the first
 * `roles.length` of the queue fill `roles` in order. Humans queue before bots, so bots only fill what humans can't.
 * Returns the new slots and the queuePos writes (current Creators only).
 */
export function rotate<R extends string>(players: Record<string, Rotating>, slots: Partial<Record<R, string>>, roles: readonly R[]) {
  const live = Object.entries(players).filter(([, p]) => !p.removed);
  const pos: Record<string, number> = Object.fromEntries(live.map(([uid, p]) => [uid, p.queuePos ?? 0]));
  let max = Math.max(0, ...Object.values(pos));
  const queuePos: Record<string, number> = {};
  for (const role of roles) {
    const uid = slots[role];
    if (uid && uid in pos) pos[uid] = queuePos[uid] = ++max;
  }
  const order = live.map(([uid]) => uid).sort((a, b) => Number(!!players[a].isBot) - Number(!!players[b].isBot) || pos[a] - pos[b]);
  const next: Partial<Record<R, string>> = {};
  roles.forEach((role, i) => { if (order[i]) next[role] = order[i]; });
  return { slots: next, queuePos };
}

/** Bot pick times (ms since start): one at ~5 s, then 1–2 more before the last 10 s (ROUND_STATE_MACHINE §5). */
export function botPlan(durationMs: number, rand = Math.random): number[] {
  const times = [4000 + rand() * 3000];
  const extra = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < extra; i++) times.push(15000 + rand() * (durationMs - 25000));
  return times;
}
