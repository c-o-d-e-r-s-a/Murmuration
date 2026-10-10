# HANDOFF

## Done this session
- B1 ([BUILD_ORDER](BUILD_ORDER.md)): `web/lib/firebase.ts` exports `app/auth/db`, `signIn()` (anonymous, returns uid), `serverNow()` (`Date.now()` + `.info/serverTimeOffset`), `trackPresence(code, uid)` (onDisconnect registered first, then `connected:true`; re-runs on reconnect), plus re-exports of common RTDB fns.
- `web/play/main.ts`: temporary B1 smoke page at `http://localhost:5173/play/?s=TEST` (Vite root is `web/`). Creates `meta` if missing (first visitor becomes host), joins with a `Guest-xxxx` nick, lists players online/offline. B2/B3 replace it.

## Next
- B2: `web/host/main.ts` (create session, QR, player list). Call `signIn()` first, then write `meta`/`players`.

## Verify status
- typecheck, lint, test, build: all pass. Manual B1 check passed against prod RTDB (second user online → offline ~4 s after disconnect).

## Decisions / docs
- None new. Web config stays in `firebase.ts` (public by design, not a secret).

## Blockers / open items
- None. `database.rules.json` unchanged; it is correct as-is.
- Prod RTDB now has a `sessions/TEST` node from the smoke test; delete it in the console when convenient.

## Gotchas
- `trackPresence` writes only `connected` + `lastSeen`, and rules reject it unless `meta` exists and `players/{uid}` already has a `nick` (create the player record with `set` first, as the smoke page does).
- `serverNow()` is local-clock until the offset listener fires (~100 ms after load).