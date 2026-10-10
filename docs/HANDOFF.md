# HANDOFF

## Done this session
- A3 base-art layer + rush-hour art ([BUILD_ORDER](BUILD_ORDER.md) §3 Track A, §8 solo: no hotspots). Lane A.
- `web/lib/renderer/sketch.ts`: `opts.baseArt`; `drawArt` paints scene `Shape[]` via `Path2D` onto a `createGraphics` layer (uniform viewBox scale, centered), redrawn only on setup/resize, blitted each frame after the wash.
- `shared/scenes/rush-hour.json`: 5 silhouette shapes (far skyline, near blocks, road, 7 small + 4 large cars), still passes the loader.
- `web/dev/main.ts`, `web/screen/main.ts`: pass `baseArt` (one-line each).

## Next
- A4 live layer in `web/lib/renderer/sketch.ts` (particles, hotspot-free motion, grain, vignette, seeded).
- Content: diner/vigilante still need scene JSON (placeholder art).

## Verify status
- typecheck, lint, test, build pass. Visual check in `/dev` done: skyline, road, cars draw over the wash.

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` still runs only `scoring.test.ts` (see prior note; off-limits).

## Gotchas
- `p5.Graphics` already scales its context by pixelDensity; don't scale again (art came out 1.5x too big).
- `/dev` color swatches overdraw the bottom 10% of the canvas (dev-only).
- Base art draws over the wash, so sky shows wash colour, ink shapes stay constant.
