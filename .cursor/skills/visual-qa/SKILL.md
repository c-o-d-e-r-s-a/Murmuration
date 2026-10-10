---
name: visual-qa
description: Visually verify the renderer, big screen, or phone UI in the browser. Use after changing visuals, smoothing, or layout.
---

# Visual QA

Budget and caps: [ARCHITECTURE §6](../../../docs/ARCHITECTURE.md), [RISKS R4](../../../docs/RISKS.md), [brief §6](../../../docs/00-brief.md).

1. Start the dev server (`npm run dev`); open `/dev` (renderer) or `/screen` + `/play` as relevant, using the browser tools.
2. Jump a slider/choice; screenshot over ~1 s. Pass = eases, no pop or jump cut. Run "simulate crowd"; no visual jumps.
3. Check fps counter ≥ 60 at 1080p with `/host` open alongside; reload with same seed and compare frames (deterministic).
4. Check `/screen` at 1280×720 and 1920×1080 viewports (nothing clipped, type readable at ~2 m) and phone at ~390 px wide (large touch targets).
5. Check flicker options stay ≤ 3 Hz, no full-screen strobe; nothing resembles a brand logo.
6. Test with only 3 Creators: it should look intentional.

**Done when:** screenshots of each checked state were reviewed and every item above passes, or failures are listed with the fix.
