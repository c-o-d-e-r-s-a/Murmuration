# HANDOFF

## Done this session
- A1 ([BUILD_ORDER](BUILD_ORDER.md)), solo scope (§8): `shared/presets.ts` (lane A) with `PRESETS`, `NEUTRAL_PRESET_ID`, `getPreset(role, id)` (unknown/wrong-role id -> neutral), `stripProtected(overrides)`, `presetParams(role, id, overrides)`.
- 4 presets each for palette (`pal-sodium/neon/dawn/bruise`), form (`form-fog/steam/sparks/dust`), motion (`motion-pulse/sway/flicker/drift`) + a neutral per role; texture/mood are neutral only (`tex-neutral`, `mood-neutral`).
- Photosensitivity: rate/area clamped at build; overrides can never set `motionRateHz`/`motionArea`.
- Check: `shared/presets.test.ts` (run `npx tsx shared/presets.test.ts`).

## Next
- A2: `RenderParams` resolve + easing loop in `web/lib/renderer/` (use `presetParams`). Also content/loader: `shared/sceneLoader.ts` should call `stripProtected` and reject unknown `presetId` via `PRESETS`.

## Verify status
- typecheck, lint, test, build re-run after a one-line type fix (see session summary).

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` only runs `scoring.test.ts`; presets test is not wired in (not allowed to edit). Suggest `tsx shared/scoring.test.ts && tsx shared/presets.test.ts`.

## Gotchas
- Neutral `mood` has an empty `moodWord`; renderer must skip the watermark when empty.
- Neutral `motion` has `motionArea: 0` / rate 0 (still).
- Prod RTDB still has `sessions/TEST` from B1 smoke test.
