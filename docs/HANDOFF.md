# HANDOFF

## Done this session
- B5 `/screen` ([BUILD_ORDER](BUILD_ORDER.md) §8 solo scope). Lane B (touches the shared renderer only by calling it).
- `web/screen/main.ts`: `?s=CODE`, anonymous sign-in, listens to `round`/`choices`/`players`; waits for all three before the first `setTarget` (refresh = no catch-up animation); wash via `resolveTarget` + `mountRenderer`; lobby view forces neutral target.
- `web/screen/index.html`: CSS in `vw`, status-driven chrome via `#ui[data-s]`: lobby (QR, code, URL, dials with nicks), live (prompt, server-time countdown, credits strip), locked (chrome fades), rating (scrim, title card, breathing "The room is judging"), reveal (compressed title card, credits).

## Next
- B6 rules + emulator tests, or Integration: T4a snapshot at lock (`web/screen/main.ts`, needs `judgeRound` stub), then P1-3/P1-4 scores on reveal.

## Verify status
- typecheck, lint, test, build pass. Not run in a browser (no live session test yet).

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` should chain `web/lib/nick.test.ts`, `web/host/machine.test.ts`.

## Gotchas
- No scores/numerals on reveal (P1-4), no snapshot upload/`judgeRound` (Integration), no rating-window rail.
- Scene change remounts p5 and leaks the old instance (one bundled scene; `ponytail:` comment).
- Fonts load from Google Fonts; offline shows fallback stacks.
- Screen roster is only the 3 solo dials; texture/mood are never shown.
