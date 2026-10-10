# HANDOFF

## Done this session
- P1-9 Part 2 ([BUILD_ORDER](BUILD_ORDER.md)): `web/host/main.ts` only.
- `logTiger(roundId)`: fire-and-forget `logRoundEvents` call; `ok:false` or any throw adds the id to an in-memory `tigerRetry` set (console warn only).
- T5: called in `.then()` of the reveal `write()`, only if `round.id`/`status === "reveal"` still holds (a failed write reverts local state, so no call). Timer path never awaits it.
- `newRound()`: if `tigerRetry.delete(round.id)` then `logTiger` once more, before the archive read.
- Part 1 (callable, `lib/tiger.ts`, test) already committed.

## In progress / next
- Run the manual check below, then P1-10 (pulse panel, `sessionPulse`).
- Manual check: `firebase deploy --only functions:logRoundEvents`; set `/config/flags/tigerEnabled = true`; open `/host` and `/screen` for the session; Add 3 bots; Start; wait for reveal. Then in Tiger run `SELECT count(*) FROM round_events WHERE session_code = '<code>' AND round_id = 'r1';` and compare with the child count of RTDB `sessions/<code>/events` (at reveal) or `sessions/<code>/rounds/r1/events` (after New round). Also set `tigerEnabled=false` and confirm reveal timing is unchanged.

## Verify status
- typecheck, lint, `npm test`, `npm run build`: pass. No secrets, brands, or live-AI paths added. Manual Tiger check not run.

## Decisions / docs
- No new D-nn; no doc conflicts found.

## Blockers / open items
- `tigerEnabled` must be `true`; the deployed `TIGER_DATABASE_URL` secret may need re-setting (SASL/password error in logs).
- Carried over: real-phone LAN run, P1-2 audio, `meta.screenUid`, custom-domain auth check.

## Gotchas
- Retry state is memory-only: a host refresh forgets it ("Re-sync Tiger" button is the upgrade path, out of scope).
- Uniqueness is `(session_code, round_id, t_ms, role, time)`: same-role events in the same ms collapse, so counts can be lower than RTDB in rare bot cases.
- If the host refreshes mid-reveal, T5 does not re-run (status already reveal), so no call happens for that round.
- Test data still in RTDB session `M2DS`.
