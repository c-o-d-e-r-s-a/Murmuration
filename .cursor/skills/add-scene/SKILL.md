---
name: add-scene
description: Add or edit a demo scene (JSON in shared/scenes). Use when creating a scene, its options, author ranks, or prompts.
---

# Add a scene

Schema: [DATA_SCHEMA](../../../docs/DATA_SCHEMA.md). Concept and the three demo scenes: [brief §4](../../../docs/00-brief.md). Presets and caps: [D-17](../../../docs/DECISIONS.md).

1. Copy an existing `shared/scenes/*.json` as the template. Set `id`, `title`, `author`.
2. `baseArt`: minimal SVG `d` paths (generic silhouettes; no brand logos or trademarked characters).
3. `options`: exactly 4 per role. Solo plan: palette/form/motion use non-neutral presets (one each of the 4 ranks); texture/mood stay on the neutral preset only. Each `{id, presetId, label, authorScore}` with evocative, scene-specific labels. Use presets only; overrides/hotspots are demo-scene only and must not set flicker rate.
4. `authorScore`: a ranking mapped to 10 / 7 / 4 / 1, each used once per role.
5. `prompts`: 8–10 varied prompts (single word, tension pair, constraint, sensory, Atlanta humor), each expressible with this scene's options. Never generated live.
6. Register the scene where the loader/host picker lists bundled scenes.

**Done when:** the loader validates the scene with no errors; `/dev` renders it with all 4 options per role; ranks are 10/7/4/1; 8–10 prompts exist; no brand names appear; `/verify` passes.
