# HANDOFF

## Done this session
- A2 ([BUILD_ORDER](BUILD_ORDER.md)), solo scope (§8), color wash only. Lane A.
- `web/lib/renderer/params.ts`: `resolveTarget(options, choices)` (scene options + choices -> full `RenderParams`, unfilled/unknown -> neutral via `presetParams`), `toCurrent(target)` (snap), `ease(cur, target, dtMs)` (exponential, `EASE_NUMERIC_MS` numerics, `EASE_PALETTE_MS` colors as RGB; mutates, no allocations besides hex parse).
- `web/lib/renderer/sketch.ts`: `mountRenderer(parent, {background, swatches?})` -> `{setTarget}`; p5 instance, DPR cap 1.5, 16:9 fit to parent; draws background + `colors[0]` wash at `washOpacity`; `swatches` draws the 4 eased colors (dev aid).
- `web/dev/main.ts`: palette buttons + washOpacity slider. **Mock**: options built from `PRESETS` (id = presetId) until `shared/scenes` + `sceneLoader` exist; background mocked `#777777`.
- Check: `web/lib/renderer/params.test.ts` (`npx tsx web/lib/renderer/params.test.ts`).

## Next
- A3 base-art layer in `web/lib/renderer/sketch.ts` (pass the scene in `mountRenderer`, replace `opts.background` with `scene.baseArt.background`). Also `shared/sceneLoader.ts` (stripProtected + reject unknown presetId).

## Verify status
- typecheck pass, lint pass (0 warnings), test pass (scoring only), build pass (dev chunk >500 kB warning from p5, harmless). Renderer self-check passes manually.

## Decisions / docs
- None new. Enums/moodWord snap instead of crossfade (ponytail note in `ease`; A4 adds the weight). Colors lerp in sRGB, not perceptual (ponytail note).

## Blockers / open items
- `package.json` `test` runs only `scoring.test.ts`; presets and renderer self-checks are not wired in (not allowed to edit). Suggest `tsx shared/scoring.test.ts && tsx shared/presets.test.ts && tsx web/lib/renderer/params.test.ts`.

## Gotchas
- `ease` uses p5 `deltaTime` (wall clock); fine for smoothing, but A4's seeded motion must use round time `t`, not `deltaTime`.
- First `setTarget` snaps current to target (screen refresh rule, ROUND_STATE_MACHINE §5); later calls ease.
- Neutral mood `moodWord` is empty; neutral motion is still (rate/area 0).
- Prod RTDB still has `sessions/TEST` from B1 smoke test.
