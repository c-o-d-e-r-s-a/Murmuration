# HANDOFF

## Done this session
- **P2 pick-order 1, `/replay`** ([BUILD_ORDER](BUILD_ORDER.md) §5, lane A/B boundary): `web/replay/main.ts` + `web/replay/index.html` only. Anonymous sign-in, one `get` of `sessions/{s}/rounds/{r}`, mounts the `/screen` renderer with `round.seed`, local clock 0 → `durationMs`. Archived events (sorted by `t`) are applied inside the renderer's `clock()` so each draw sees the target for its time. At `t = durationMs` it remounts with `choices` (current = target, same as `/screen` after lock), scales the stage to 0.6, fires the bloom, shows author/AI/audience/combined + credits from `playersSnapshot`.
- Errors (missing params, no archive, unknown scene, no seed/duration) show in `#msg`; no crash. Read-only: no `judgeRound`/reimagine/Tiger calls, no rules or functions changes.
- Earlier (carried, not committed): P1-10, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- **`/replay` manual check** (not run in a browser): full round with bots → New round → open `/replay/?s=CODE&r=rN` → motion follows the events, ends in scores; refresh mid-replay restarts from 0 coherently.
- Still open: P1-10, P1-7, P1-6 manual checks; P1-8 clips (ElevenLabs key).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning only). Not run in a browser.

## Decisions / docs
- No new D-nn. Smoothing choice: events only move the target and the renderer eases, as live (frame-equivalent per CONTRACTS §5/§9).
- Skipped: replay link on `/host`; the URL is typed by hand (`rN` = the round id shown on `/host`). Replay has no pause/restart UI (refresh restarts); no reveal audio/dot burst, no Reimagined panel.

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing (402 → Reimagined fails, judge goes canned).
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Only rounds archived by **New round** exist; Reset does not archive, and a round still in `reveal` has no archive yet.
- Scene is looked up in `BUNDLED_SCENES`; a replay of a round from a scene removed from the bundle shows "Unknown scene".
- The final remount catches up ~5k sim steps in one frame (same as `/screen`); a brief hitch at reveal is expected.
- A background tab pauses rAF but the local clock keeps running, so events apply in a batch on return.
- `npm test` doesn't run `functions/src/*.test.ts`; run them by hand with `tsx`.
