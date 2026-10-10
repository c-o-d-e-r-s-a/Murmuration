# HANDOFF

## Done this session
- B2 `/host` lobby ([BUILD_ORDER](BUILD_ORDER.md) §8 solo scope). Lane B, only `web/host/main.ts` changed.
- T1 create session (4-char code, `meta` then `round` r0/lobby, sequential because the round rule reads stored `meta.hostUid`); resume via `?s=CODE` or `localStorage murmuration.hostCode`; foreign-host code errors out.
- QR for `${origin}/play?s=CODE`, scene picker (`BUNDLED_SCENES`), duration (60/90/120), player list (presence dot, rename, remove, slot select), "Add 3 bots", "New session".
- Slot writes are one multi-path update (`round/slots/*` + `players/*/slot|role`).

## Next
- B3 `/play` (replace B1 smoke in `web/play/main.ts`): join with nick, spectator/creator screens, tap writes `choices` + `events`. Needs `web/lib/nick.ts` filter.

## Verify status
- typecheck, lint, build pass; `npm test` (scoring only) passes. Manual 5-phone check not run by agent (needs deployed rules + phones).

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` still runs only scoring (suggest chaining the other `*.test.ts`).
- QR uses `location.origin`; on `localhost` phones can't reach it. Open `/host` via LAN IP or deployed URL.

## Gotchas
- Only palette/form/motion are assignable (solo scope); texture/mood stay neutral.
- Removal sets `removed: true` (never deletes); host list hides removed. Bots are `bot_n`, auto-take free slots.
- Skipped: queuePos-to-front on assign (rotation, P1-5), prompt preview/reroll (B4), bot choices (B4), gallery picker (Integration).
- `/play` B1 smoke creates `sessions/TEST`; prod RTDB still has it.
- Host list skips re-render while a nick input is focused (blur to refresh).
