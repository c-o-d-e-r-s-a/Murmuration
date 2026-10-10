---
name: judge-script
description: Write or tune the Gemini judge prompt and spoken verdict script (and its canned fallbacks). Use when touching judgeRound, verdict text, or fallback verdicts.
---

# Judge + verdict script

Rules: [brief §8–9](../../../docs/00-brief.md), [D-22–D-25](../../../docs/DECISIONS.md). Output shape: [CONTRACTS](../../../docs/CONTRACTS.md).

1. One Gemini call returns structured JSON `{score, comment, script}`; no preamble.
2. Input: scene, task prompt, each role's chosen option **label**, snapshot. Never nicknames; never the audience score.
3. Script: 40–60 words, cites at least two chosen options, one joke, one genuine observation. Roast the art, never people.
4. Validate output after parsing (score 1–10, word count, JSON shape); on failure use the canned per-scene fallback.
5. Keep every call behind its flag with a timeout and per-session cap.

**Done when:** a sample run gives valid JSON within 40–60 words citing ≥2 options; a forced failure/timeout yields the canned fallback; each demo scene has a fallback verdict; no keys appear client-side.
