# HANDOFF

## Done this session
- P1-9 Part 1 ([BUILD_ORDER](BUILD_ORDER.md)): Tiger pool + `logRoundEvents` callable. No host wiring.
- `functions/src/lib/tiger.ts`: `TIGER_DATABASE_URL` secret, lazy `pg.Pool` (max 2, TLS verified, connect/statement/query timeout = `TIGER_TIMEOUT_MS`), `tigerFailure()` maps errors to `"timeout" | "error"` and logs without the URL.
- `functions/src/logRoundEvents.ts`: auth = `meta.hostUid`, then `tigerEnabled`, then reads `rounds/{roundId}` if archived, else live `events`/`results` only while `round.status == "reveal"`. One SQL statement (two data-modifying CTEs, `unnest` arrays, both `ON CONFLICT DO NOTHING`). Only auth errors throw; everything else returns `{ok:false, reason}`.
- `functions/src/logRoundEvents.test.ts`: live insert, idempotent re-run, bogus-URL timeout, cleanup (session code `SELFTEST`).
- `functions/package.json`: `pg ^8.23.1`, `@types/pg ^8.23.1`. Exported from `functions/src/index.ts`.

## In progress / next
- P1-9 Part 2: `web/host/main.ts` calls `logRoundEvents` at T5 (fire-and-forget) and retries once at NEW_ROUND if `ok:false`.
- Then the BUILD_ORDER verify: a bot round where `SELECT count(*) FROM round_events WHERE round_id = ...` equals the RTDB event count.

## Verify status
- typecheck, lint, `npm test`, `npm run build`, `functions` `tsc` all pass.
- Self-check `npx tsx --env-file=functions/.secret.local functions/src/logRoundEvents.test.ts`: inserted 4, then 0; bogus URL `{ok:false, reason:"timeout"}` in ~5.0 s; cleanup deleted 4 events + 1 round.
- Not deployed. Deploy: `firebase deploy --only functions:logRoundEvents`.

## Decisions / docs
- No new D-nn. Tiger is TimescaleDB 2.30.2 on Postgres 18.6; `WITH (tsdb.hypertable)` worked (`round_events` is a hypertable), so the `create_hypertable` fallback in DATA_SCHEMA §8 isn't needed.

## Blockers / open items
- `/config/flags/tigerEnabled` must be `true` in RTDB or the callable returns `disabled`.
- The deployed `TIGER_DATABASE_URL` secret (v1) may be the same password-less string the local file had. Re-set it if the first deployed call logs a SASL/password error.
- Carried over: real-phone LAN run, P1-2 audio, `meta.screenUid`, custom-domain auth check.

## Gotchas
- The `rounds` row is write-once (`ON CONFLICT DO NOTHING`). Part 2 must call after the host writes `results.audience` and `combined` at reveal, or those columns stay null forever.
- Worst-case latency is connect 5 s + statement 5 s = 10 s (function timeout is 15 s). Not a single 5 s budget.
- `sslmode=require` makes `pg` print a security warning (it treats it as `verify-full`). Changing the URL to `sslmode=verify-full` silences it.
- Uniqueness is `(session_code, round_id, t_ms, role, time)`: two events with the same role in the same ms collapse into one row.
- Test data still in RTDB session `M2DS`.
