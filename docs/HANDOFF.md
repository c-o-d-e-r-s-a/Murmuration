# HANDOFF

## Done this session
- P1-5 (solo, 3 slots): role rotation on New round + late joiners ([BUILD_ORDER](BUILD_ORDER.md)).
- `web/host/machine.ts`: pure `rotate(players, slots, roles)`. `web/host/main.ts` `newRound()` (T6 only) writes `round/slots`, `players/*/{slot,role}` and the Creators' new `queuePos` in the same multi-path update as the archive.
- `web/host/machine.test.ts`: asserts for 6 players/2 rounds, 8/3 rounds, late joiner, humans-before-bots, removed skipped.
- Docs: D-42 (T7 Reset keeps slots and queue); ROUND_STATE_MACHINE §2 T7 row fixed.

## In progress / next
- Next per [§8](BUILD_ORDER.md): bots/refresh test, P1-9 Tiger mirror. First do the manual rotation check against a real session (steps in the chat report); not run against RTDB yet.

## Verify status
- `/verify`: typecheck, lint, `npm test`, build all pass; `npx tsx web/host/machine.test.ts` ok.
- Rules emulator not run (no Java); rules unchanged. Host `queuePos` write is allowed by the existing `queuePos` validate (host uid), but not exercised live.

## Decisions / docs
- D-42 added. Late joiners already sort last (`/play` and `addBots` write `queuePos: serverTimestamp()`); confirmed, no change.

## Blockers / open items
- Carried over: real-phone LAN run, P1-2 audio, `meta.screenUid`, custom-domain auth check (see git history of this file).

## Gotchas
- Creators go to `max+1..+3`, where max includes any late joiner's timestamp, so a late joiner queues ahead of the Creators who just played, behind everyone already waiting.
- Bots rank after all humans; with ≥3 humans, bot Creators are rotated out on New round. With <3 humans, bots fill the gap.
- Not done (out of scope): host "Assign to" moving `queuePos` to front (§4 override), skipping disconnected players, P1-10.
- Test data still in RTDB session `M2DS`.
