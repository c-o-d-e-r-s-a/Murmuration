# HANDOFF

## Done this session
- **P1-4 audio UI / play half of P1-2** ([BUILD_ORDER](BUILD_ORDER.md) §4/§8): `/screen` plays `results.verdict.audioUrl` at reveal. `web/screen/main.ts` (`syncVoice()`, called from `render()`) and `web/screen/index.html` (`.play-verdict` button). No new listeners, no writes.
- Earlier: P1-2 backend (ElevenLabs in `functions/src/judgeRound.ts`, not deployed, not committed).

## In progress / next
- Manual check below (needs deployed functions + a real `audioUrl`), then deploy functions and run the P1-2 cache-hit check.
- Then P1-10 or A3 (fallback clips).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning, already there).
- Playback NOT tested in a browser.

## Decisions / docs
- No D-nn added. Conflict noted: `docs/01-art-direction.md` L202 says unlock at session start + host manual Play; this slice follows the task/ARCHITECTURE (screen plays; Play button appears only if autoplay is blocked). SFX ducking not done (no SFX bus).

## Blockers / open items
- Carried: hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.
- No `fallback/{sceneId}/0.mp3` yet (A3), so fallback path gives `audioUrl: null` (text only).

## Gotchas
- Plays once per round+url, only while status is `reveal`; the url arriving late (ready after reveal) still plays. A refreshed /screen at reveal replays it.
- Autoplay is allowed once the page has had a gesture (e.g. a click on /screen); otherwise the "Play verdict" button shows.
- Worst-case Gemini 12 s + TTS 10 s can pass the 25 s cap; verdict then lands late.
- Fallback/cached URLs need a download token; upload via the console.
