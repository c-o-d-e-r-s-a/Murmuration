# HANDOFF

## Done this session
- Verify block (BUILD_ORDER §8 h16–h22: P1-1, P1-3, P1-4) run against prod `https://murmuration-33d60.web.app` with session `M2DS` (3 bot Creators, 10 bot Spectators, 60 s rounds).
- Deployed: hosting + database rules (unchanged) + functions (unchanged, skipped). `/config/flags/aiEnabled` toggled false then back to true (final state: true).
- One bug fixed: `web/screen/index.html` `.verdict` overflowed the scoreboard (bottom at 1292 px on 1080p, 868 px on 720p). It is now `position: fixed`, bottom-left, 50vw wide, clamped to 4 lines, clear of the board and credits.

## In progress / next
- Next per [§8](BUILD_ORDER.md): P1-5 rotation, bots, refresh test, P1-9 Tiger mirror (`web/host/main.ts` T6 is where rotation goes).

## Verify status
- `/verify`: typecheck, lint, `npm test`, `vite build` all pass (re-run after the CSS fix).
- aiEnabled=false: reveal 13.7 s after lock, canned `ai` 6.0 + canned verdict (P1-1 ✓).
- aiEnabled=true: real score from `gemini-3.8-flash`, `fallback:false`; reveal 15.3 s after the rating window opened (P1-1 ✓).
- 10 bot votes: trimmed mean 8.25 matches `scoring.ts` by hand; combined = equal-weight mean ✓ (P1-3).
- Phone at 390 px: rating buttons 64×64, vote write-once (second tap ignored, stored 4) (P1-3).
- ROUND_STATE_MACHINE §5: judge-fail path ✓; screen reload right after lock (T4a) judged once and revealed ✓; near-simultaneous bot writes both logged in `events` ✓.
- Rules unchanged; rules emulator not run (no Java on PATH).

## Decisions / docs
- None new. ARCHITECTURE §4 still says `results/snapshotRequested`; real key is `judgeRequestedAt`.

## Blockers / open items
- Real-phone run over the LAN not done (no phone here); only a 390 px emulated tab was used.
- No audio / "manual Play" (P1-2 not built), so the P1-4 "audio unlock" clause is not testable yet.
- `meta.screenUid` is never written, so `/screen` must share browser + hostname with `/host`.
- Custom domain `mybossdoeslameicebreakers.work/host/` serves over HTTPS, but a headless fetch showed `auth/network-request-failed`; confirm anonymous sign-in works there from a real browser (Auth authorized domains).
- Pre-demo items not applicable yet: fallback clips (P1-8), host phone/hotspot checks.

## Gotchas
- `/screen` must be the foreground tab when a round locks: a hidden tab never captures, so no judge call, no AI score, and the reveal waits for the 25 s cap. `/host` is fine hidden (worker tick).
- At 1280×720 the scoreboard bottom is ~10 px over the credits strip (pre-existing, not fixed).
- Test data left in RTDB session `M2DS` and Storage `snapshots/M2DS/`.
- Live judge self-check: `npx tsx --env-file=functions/.secret.local functions/src/judgeRound.test.ts`. Rules tests (Java 21): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`.
