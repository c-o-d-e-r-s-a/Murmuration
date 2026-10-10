# HANDOFF

## Done this session
- Integration part 2/2 ([BUILD_ORDER](BUILD_ORDER.md) §3 Integration: "Wire real scenes / bots full round", "Lock -> snapshot JPEG", "Scripted refresh/disconnect test"; solo §8). Lanes A + B, no contracts/rules/package changes.
- `web/lib/renderer/sketch.ts`: `mountRenderer` returns `remove()` (p5 leak fixed: 3 scene switches keep 3 canvases); `clock` may return null (= ms since mount); `stats.frames` counts finished draws.
- `web/screen/main.ts`: clock = `clamp(serverNow() - startsAt, 0, durationMs)` while live, exactly `durationMs` after, null in lobby. Remount key = scene + round.id + phase (lobby / live / locked) + final optionIds when locked. Leaving live remounts fresh (current = target, t = durationMs) = one canonical locked frame. Adaptive stays off. Snapshot: first locked frame drawn onto 1280x720, JPEG 0.8, base64 in memory; `?debug=1` logs `{width, height, kb, base64Length}` and shows a download link. One `TODO(P1-1)` for judgeRequestedAt + judgeRound.
- `web/play/main.ts`: "Reconnecting…" banner + buttons disabled on `.info/connected == false`; countdown now formats like `/screen` (was `0:00` at 59.x s and `1:00` at 119.x s).

## ROUND_STATE_MACHINE §5 checklist (prod RTDB, host+screen on `localhost`, phone on `127.0.0.1` = separate uid, 3 bots, 4 rounds)
- [x] Host refresh mid-round: observed in browser. live t≈10 s resumes, bots continue; closed across endsAt then reopened -> T3+T4 ran; reload at endsAt+300 ms -> T3 by reloaded page; reload in rating -> reveal at the 25 s cap; reload ~1 s into locked -> rating at +1.97 s (couldn't tell old vs new page wrote T4). statusVersion strictly +1 per step. Fix: none.
- [x] Screen refresh mid-round: observed. Live: right scene/choices, countdown matches phone, no catch-up animation. Rating + reveal: canvas and snapshot hashes identical to the unrefreshed screen (r1, r2). T4a judge part: N/A (P1-1). Fix: deliverable 1.
- [x] Phone refresh / reconnect: observed. Reload mid-live keeps uid + Palette; `goOffline` shows banner + disables buttons, host shows offline dot; `goOnline` restores. Fix: banner added (was missing).
- [x] Creator disconnects: observed. Last choice stands on screen; host reassigned Palette to Bot 3 mid-live, bot picked; phone came back as Spectator. Fix: none.
- [x] Nobody joins: observed (Add 3 bots fills form/motion + 1 spectator; bots pick ~5 s then 1–2 more). Bot votes: N/A (P1-3).
- [x] Two phones claim a role: observed. Phone writing `choices/form`, `round/status`, `round/slots/form` -> PERMISSION_DENIED.
- [ ] Near-simultaneous choice writes: traced in code (one key per role, events push-only); not forced in browser.
- [ ] Join storm: traced in code (distinct keys; screen shows 3 dials + count). Not load-tested.
- [ ] Judge call fails: N/A (P1-1). Today the rating window always runs to the 25 s cap (no verdict yet).
- [x] Host closes laptop: observed. `/host/` without `?s` resumed SBNE from localStorage.

## Verify status
- typecheck, lint, `npm test`, build pass; all 7 `*.test.ts` pass via `npx tsx`. `database.rules.test.mts` passes in the emulator (36 assertions; command in Gotchas).

## Decisions / docs
- No new D-nn. D-18 clarified: "filled" = has a choice at lock (matches `authorScore`; a slot that never picked is skipped).

## Blockers / open items
- Real-phone QR run over LAN not done (`npm run dev -- --host`).
- `.cursor/skills/judge-script/SKILL.md` still says input "scene" (should be `scene.description`). `Scene.description` type + rush-hour field deferred to P1-1.

## Gotchas
- Locked frame is pixel-equal only at the same canvas size/DPR; the snapshot is resampled to 1280x720 either way.
- Mid-live refresh runs every missed step in one frame (up to 7200 x 1200 particles at 120 s): a short hitch, by design.
- Crossfading fog <-> dust draws big squares for ~1 s (sharp kinds use the fog's particleSize). Visible in live, not in the locked frame.
- Testing two identities in one browser: use `localhost` vs `127.0.0.1` (separate anonymous uid).
- Rules tests (needs Java 21 on PATH): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`. The comment in that file still says `.ts`.
