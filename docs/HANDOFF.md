# HANDOFF

## Done this session
- Content rows (option labels, prompts, ONE scene) + loader, solo scope ([BUILD_ORDER](BUILD_ORDER.md) §8). Content lane + lane A.
- `shared/scenes/rush-hour.json`: 4 options x 5 roles (ranks 10/7/4/1), 10 prompts, `baseArt.shapes: []`, background `#0f0e14`. Texture/mood all point at `tex-neutral`/`mood-neutral`.
- `shared/sceneLoader.ts`: `loadScene(raw)` (throws `scene "id": ...`), `BUNDLED_SCENES` (rush-hour). Checks 4/role, unique ranks in 10/7/4/1, preset exists and matches role, unique option ids, label <= `OPTION_LABEL_MAX`, prompt <= `PROMPT_TEXT_MAX`, strips protected overrides; custom: strips overrides + hotspot.
- `web/dev/main.ts`: uses `BUNDLED_SCENES[0]` options + `baseArt.background` (PRESETS mock removed).
- Check: `npx tsx shared/sceneLoader.test.ts`.

## Next
- A3 base art: fill `rush-hour.json` `baseArt.shapes`; pass the scene into `mountRenderer` (`web/lib/renderer/sketch.ts`) instead of `background`.

## Verify status
- typecheck, lint, build pass; `npm test` (scoring) passes; all four `*.test.ts` (scoring, presets, sceneLoader, renderer params) pass via tsx.

## Decisions / docs
- None new. Labels use the art-direction cap (18), loader enforces the contract cap (28, D-/DATA_SCHEMA).

## Blockers / open items
- `package.json` `test` still runs only scoring; suggest `tsx shared/scoring.test.ts && tsx shared/presets.test.ts && tsx shared/sceneLoader.test.ts && tsx web/lib/renderer/params.test.ts`.

## Gotchas
- Only 4 non-neutral palettes exist, none red, so "Brake-Light Red" (brief example) isn't an option; labels were mapped to the actual preset colors.
- Texture/mood options are all one preset each, so ranks affect author score only, not visuals.
- Never `Get-ChildItem -Recurse *.test.ts` without excluding `functions/node_modules` (jest tests there fail).
- Prod RTDB still has `sessions/TEST` from B1 smoke test.
