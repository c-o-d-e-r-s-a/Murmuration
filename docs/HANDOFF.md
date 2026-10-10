# HANDOFF

## Done this session
- [P1-4](BUILD_ORDER.md) (minus polish, solo §8): three-score reveal on `/screen`. Files: `web/screen/main.ts`, `web/screen/index.html` only.
  - Beat 5 rating rail (bottom 4 px): drains once from settle end toward the 25 s cap; once `verdict.ready` is set it re-targets to `ratingEndsAt` (one 240 ms ease). Fixed after user test: it used to refill to 1/4 on each 3 s extension.
  - Beats 6-7 at `reveal`: artwork scales to 0.6 left, board on right with Author / AI / Audience cards (stamp 400 ms apart, count-up 600 ms, one decimal at the end) then Combined slam at 1.6 s. Captions: "from N ratings" / "no ratings", AI comment + "(offline judge)", "judge offline".
  - Beat 9 credits strip (per dial: nick · role · option label) fades in at reveal + 2.6 s.
  - Refresh mid-reveal shows final values instantly (`instant` class), no catch-up animation.
- Listens to `results` (4th listener; render waits for 4 paths). Adaptive window was already host-side; not touched.

## In progress / next
- Next task: [P1-1](BUILD_ORDER.md) `judgeRound`. `TODO(P1-1)` in `web/screen/main.ts` `capture()`. When `results.ai` / `results.verdict.script` get written, the screen shows them with no further change.

## Verify status
- `/verify`: typecheck, lint, `npm test`, build pass. Rules untouched (emulator not rerun). Browser visual QA not run this session.

## Decisions / docs
- No new D-nn. Missing AI shows "--" with caption "judge offline" (art direction says em dash; user asked for "--").

## Blockers / open items
- Visual check of reveal layout (title card at top-left vs scaled artwork overlap) still needed on a real session at 1280×720 and 1920×1080.
- Verdict audio, Play button, sounds, light bursts, credits stagger, Reimagined: P1-2 / P1-6 / P1-7.
- `judge-script` skill still says input "scene" (should be `scene.description`).

## Gotchas
- `/host` must stay open (Blob worker tick keeps it running in background).
- Bot Spectators vote only while `round.status == "rating"`; rating window runs to the 25 s cap until `verdict.ready` exists.
- Two identities in one browser: `localhost` vs `127.0.0.1`.
- Rules tests (Java 21): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`.
- Count-up uses `performance.now` (chrome only; renderer stays deterministic).
