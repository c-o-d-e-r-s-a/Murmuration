# HANDOFF

## Done this session
- B4 state machine on `/host` ([BUILD_ORDER](BUILD_ORDER.md) §8 solo scope). Lane B.
- `web/host/main.ts`: T2 Start (guard ≥ 3 slots, seed, `startsAt`, clears last round's data, `players/*/role` from slots), T3 lock + `results.author`, T4 settle, T5 reveal with 3 s extensions while `verdict.ready` is false (cap: lock + 26.5 s) + `results.audience`/`combined`, T6 New round (archive to `rounds/{id}`), T7 Reset (confirm, releases the aborted prompt), T8 Reroll. Every lobby entry (T1, T6, T7, scene change) draws a preview prompt.
- 250 ms tick re-derives steps from server timestamps; acts only after all 6 listeners have fired once. Stale `round` snapshots (lower `statusVersion`) are dropped; `busy` stops double-fires.
- Bot Creators pick at ~5 s, then 1–2 changes (writes `choices` + `events` as host). Host reload skips picks already past.
- `web/host/machine.ts` (pure: `due`, `drawPrompt`, `botPlan`, `ratingCap`) + `machine.test.ts`.

## Next
- B5 `/screen` (`web/screen/main.ts`): subscribe to `round`/`choices`/`players`/`results`, render via Track A, lobby/live/lock/reveal views.

## Verify status
- typecheck, lint, test, build all pass. `npx tsx web/host/machine.test.ts` passes (not in `npm test`; package.json is off limits).
- Browser run with 3 bots on session `5C2P`: lobby → live → locked → rating → reveal → lobby, host refreshed during live and rating, resumed both times. Archive and reset checked in RTDB. Locked/reveal-state refresh and real-phone taps not run.

## Decisions / docs
- None new. T6 keeps the same slots; queue rotation is P1-5.

## Blockers / open items
- No `judgeRound` yet (P1-1), so every rating window runs to the 25 s cap.
- `package.json` `test` should chain `web/lib/nick.test.ts` and `web/host/machine.test.ts`.

## Gotchas
- No bot Spectator votes (P1-3 owns that); audience is `method:"none"` until ratings exist.
- No `reimagineRound`/`logRoundEvents` calls at T5 (P1-7, P1-9). No `gallery.plays` increment at Start.
- Two `/host` tabs on one session can both fire a timer step (local `busy` guard only); keep one tab.
- `serverNow()` offset is 0 for the first few hundred ms after load; a badly skewed laptop clock could fire one step early on refresh.
- Test sessions `5C2P` (and old `TEST`) are in prod RTDB.
