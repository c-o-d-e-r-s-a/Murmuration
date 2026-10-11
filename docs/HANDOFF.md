# HANDOFF

## Done this session
- **P1-10 part 2, pulse panel** ([BUILD_ORDER](BUILD_ORDER.md) §4, lane B): `web/host/main.ts` only. `pulseEl` is appended at the bottom of `/host`. `pollPulse()` calls `sessionPulse` on mount and every `PULSE_POLL_MS` (page-lifetime `setInterval`, no teardown). `renderPulse()` draws one div-bar sparkline per role (palette/form/motion, last 30 buckets), the top option label (resolved from `BUNDLED_SCENES`), and "Rounds played / avg combined". A red "stale" badge shows on `stale:true` or a thrown error. The last good payload is kept and never cleared. Nothing blocks Start / New round / timers.
- Earlier (carried, not committed): P1-10 part 1, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- **P1-10 manual check** (deploy functions; `/host` + `/screen`; `tigerEnabled=true`; Add 3 bots; Start; wait for reveal; panel moves within 20 s; set `tigerEnabled=false`, stale badge appears; `/screen` unchanged).
- Still open: P1-7 / P1-6 manual checks, P1-8 clips (ElevenLabs key).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning only). Not run in a browser or against a deployed function.

## Decisions / docs
- No new D-nn. The panel is always polled (the "while the panel is open" wording is satisfied trivially; there is no collapse UI).

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing (402 → Reimagined fails, judge goes canned).
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- The panel stays empty until the first poll settles (up to about 5 s if Tiger is down), then shows "stale" with "–" values.
- Buckets only cover rounds started in the last 15 min (`round_events.time = startsAt + t_ms`); `topOptions` and `rounds` are session-wide.
- The continuous aggregate's refresh lag may add delay beyond the 10 s poll. Check the 20 s budget live.
- `npm test` doesn't run `functions/src/*.test.ts`; run them by hand with `tsx`.
