# HANDOFF

## Done this session
- **P2 pick-order 5, Spectator energy dial** ([BUILD_ORDER](BUILD_ORDER.md) §8 P2; lanes B + A touched):
  - `database.rules.json`: `energy/{uid}` (own uid, spectator, not removed, `live` + inside window, integer 0..100; host may clear). Emulator assertions added in `database.rules.test.mts`.
  - `web/play/main.ts`: Spectator-only range slider during `live` (disabled offline), trailing throttle at `ENERGY_WRITE_THROTTLE_MS`, resets to 50 each round.
  - `web/screen/main.ts` + `web/lib/renderer/params.ts` (`applyEnergy`): mean of `energy/*` → 0.7..1.3× on `particleSpeed`/`particleDensity` in the **target**; existing ease does the smoothing. No sketch/live changes. Unit test in `params.test.ts`.
  - `web/host/main.ts`: `energy: null` on START and `toLobby()`.
- Earlier (carried, not committed): P2 narration, poster (D-37), replay OG, `/replay`, P1-10, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- Manual energy check (steps in chat report). Then next P2/other item per BUILD_ORDER §8, or freeze.
- Still open: narration generator run (ElevenLabs key); deployed OG check; `/replay`, P1-10, P1-7, P1-6, poster manual checks; P1-8 clips.

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass. Also run by hand: `params.test.ts` pass; rules emulator test pass (45 assertions, `firebase emulators:exec --only database "npx tsx database.rules.test.mts"`). Energy not yet exercised in a browser.

## Decisions / docs
- None new. DATA_SCHEMA has no `energy/` node entry (only CONTRACTS §3 row); add one line when docs are next touched.
- Energy is not archived to `rounds/{id}` and not in the event log, so `/replay` shows no energy nudge (replay stays deterministic from choices).

## Blockers / open items
- ElevenLabs key (narration generator). Gemini image calls need AI Studio billing (402 → canned judge).
- Carried: hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Energy is applied to the target in any non-lobby status, so the locked frame includes the last energy (host clears it on START/lobby). Refreshed `/screen` mid-round snaps to current energy.
- Bots don't write energy; test with a real phone/second tab.
- Narration URL hardcoded to bucket `murmuration-33d60.firebasestorage.app`; audio plays on host only.
- `npm test` runs only the scoring check; run `params.test.ts` and the rules test by hand.
