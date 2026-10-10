# HANDOFF

## Done this session
- A5 performance ([BUILD_ORDER](BUILD_ORDER.md) §3 Track A, §8 solo). Lane A only.
- `web/lib/renderer/sketch.ts`: smoothed frame time -> `stats {fps, scale, drawn}` (returned from `mountRenderer`); opt-in `adaptive` option scales how many particles are *drawn* (15%..100%, drop ×0.97/frame when >20 ms, recover +0.002/frame when <17.5 ms). DPR cap (`PIXEL_DENSITY_CAP` 1.5) and once-drawn base art were already in place.
- `web/dev/main.ts`: fps/particles/canvas-size readout; adaptive on unless `?t=` is set or `?adaptive=0`.
- Earlier (A4): `live.ts` seeded live layer, `live.test.ts`, `?seed=&t=` pixel hash.

## Next
- A6 is cut in solo plan. Next is B-track / integration. `/screen` should pass `clock: () => serverNow() - round.startsAt` and remount per round; decide whether to set `adaptive: true` there.

## Verify status
- typecheck, lint, test, build pass; `npx tsx web/lib/renderer/live.test.ts` passes.
- 60 fps on the demo laptop at 1200 particles: NOT yet measured by me (see manual check).

## Decisions / docs
- None new. Adaptive only changes draw count; simulation always steps all 1200, so state stays deterministic (snapshot pixels may differ if adaptive sheds particles). Keep `adaptive` off on `/screen` unless the laptop needs it.

## Blockers / open items
- `npm test` only runs `scoring.test.ts` (`package.json` off-limits); run renderer tests by hand.

## Gotchas
- Sim cost (1200 particles stepped per frame) is not reduced by adaptive; only drawing is. If sim is the bottleneck, fps won't recover.
- Frame time is read from p5 `deltaTime`; gaps >500 ms (hidden tab) are ignored.
- Pixel hashes only match at the same window size and DPR.
