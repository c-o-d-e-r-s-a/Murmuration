# HANDOFF

## Done this session
- B3 `/play` + choice write ([BUILD_ORDER](BUILD_ORDER.md) §8 solo scope). Lane B.
- `web/play/main.ts` (replaced B1 smoke): join form (optional nick), Spectator waiting text, Creator screen with 4 option buttons from the bundled scene, server-time countdown, haptics (30 tap, 60 lock, `[40,60,40]` on role card).
- Tap = one multi-path `update` of `choices/{role}` + `events/{push}`; `at` uses `serverTimestamp()` (rules require `at <= now`), `t` from `serverNow()` clamped.
- `web/lib/nick.ts` (+ `nick.test.ts`): trim, 16-char cap, blocklist, `Guest-xxxx` fallback.
- No rules/contracts/package.json changes: existing `database.rules.json` already covers B3.

## Next
- B4 state machine in `web/host/main.ts` (T1–T8, timers, `statusVersion`, prompt draw, bot choices). Until it exists nothing sets `round.status = "live"`, so the Creator buttons can only be exercised by hand-editing `round` in the console.

## Verify status
- typecheck, lint, test, build pass. `npx tsx web/lib/nick.test.ts` passes (not chained into `npm test`; package.json is off limits). Manual 2-phone check not run.

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` runs only scoring; suggest `tsx shared/scoring.test.ts && tsx web/lib/nick.test.ts && ...`.
- QR/URL uses `location.origin`; use LAN IP or deployed URL for phones.

## Gotchas
- Phone role comes from `round.slots` (host-written), not `players/{uid}.role`.
- Rejoin: if `players/{uid}` exists the join form is skipped and the stored nick is kept (nick edit UI not built).
- Spectators get no rating UI yet (P1-3). Texture/mood have no phone UI (solo scope).
- Nick blocklist is substring-only; digits/leetspeak not normalised (`ponytail:` ceiling); host can rename.
- Old B1 `sessions/TEST` may still exist in prod RTDB.
