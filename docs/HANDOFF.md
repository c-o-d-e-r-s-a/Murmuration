# HANDOFF

## Done this session
- A4 live layer ([BUILD_ORDER](BUILD_ORDER.md) §3 Track A, §8 solo: 3 roles, no hotspots). Lane A only.
- `web/lib/renderer/live.ts` (new): pure, seeded (mulberry32) live state stepped at fixed 1/60 s: 1200-particle pool (fog/steam/sparks/dust), per-kind crossfade weights for particle and motion kinds, integrated motion phase, motion light (no hotspots in solo, so motion drives one accent glow behind the skyline; rate/area re-capped at `FLICKER_MAX_HZ`/`FLICKER_MAX_AREA`).
- `web/lib/renderer/sketch.ts`: steps `live` to `clock()` and draws wash, motion light, base art, particles, mood watermark (only if `moodWord`), grain (seeded tile, 12 Hz offset), vignette. New opts `seed`, `clock` (default ms since mount).
- `web/lib/renderer/live.test.ts` (new): same seed + same events, identical state at t=30 s; caps hold against a bad target.
- `web/dev/main.ts`: buttons for palette/form/motion; `?seed=&t=` freezes the clock and prints a pixel hash; `?palette=&form=&motion=` preselect option ids.
- `web/screen/main.ts`: passes `seed: round.seed` (one line). `params.ts`: comment only.

## Next
- A5 (performance): DPR is already capped; add adaptive particles + fps counter in `/dev`. Note that adaptive count breaks pixel-identical replay unless it is frozen during a round.
- Integration: `/screen` should pass `clock: () => serverNow() - round.startsAt` and remount (or reseed) per round, not per scene.

## Verify status
- typecheck, lint, test, build pass. `npx tsx web/lib/renderer/live.test.ts` passes (not in `npm test`; `package.json` off-limits).
- Browser: `/dev/?seed=7&t=30000&...` hash `3040444c` on two loads; seed 8 differs. Fog/sparks/glow look right; 61 fps at 1122×631.

## Decisions / docs
- None new. Deviation worth a D-nn if kept: live layer uses its own seeded PRNG + sin-based drift instead of p5 `randomSeed`/`noise` (node-testable, per-instance). ARCHITECTURE §6 still says p5 random/noise.

## Blockers / open items
- `npm test` runs only `scoring.test.ts`; params/live/loader tests must be run by hand until `package.json` changes.

## Gotchas
- `live` state is created on the first frame with a target; changing seed needs a new `mountRenderer`.
- Catch-up after a long gap runs every missed step in one frame (~5k steps max per round).
- With `?t=` frozen, buttons change target but nothing moves (no steps advance).
- Pixel hashes only match at the same window size and DPR.
