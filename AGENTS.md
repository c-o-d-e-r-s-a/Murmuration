# AGENTS.md — Murmuration

Live cooperative art game for a 36-hour hackathon. Phones scan a QR; up to 5 **Creators** each own one dial (palette, form, motion, texture, mood) of ONE shared artwork on the big screen; everyone else is a **Spectator** and rates. Three judges: Scene Author taste, AI (Gemini), audience.

Source of truth: [brief](docs/00-brief.md) (what/why) · [DECISIONS](docs/DECISIONS.md) (D-nn, settled) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ROUND_STATE_MACHINE](docs/ROUND_STATE_MACHINE.md) · [CONTRACTS](docs/CONTRACTS.md) · [DATA_SCHEMA](docs/DATA_SCHEMA.md) · [RISKS](docs/RISKS.md) · [BUILD_ORDER](docs/BUILD_ORDER.md). If code and docs disagree, update DECISIONS first. Don't duplicate docs here.

## Stack
Vite multi-page TS (loose) · p5.js 1.x · Firebase (RTDB only, Anonymous Auth, Hosting, Functions 2nd gen, Storage) · Gemini (judge, script, Reimagined image) · ElevenLabs · Tiger Data · `shared/` imported by web and functions.

## Lanes (see BUILD_ORDER for tasks)
| Lane | Owns |
|---|---|
| A — Renderer | `web/lib/renderer/`, `web/screen/` visuals, `web/dev/`, `shared/presets.ts`, `shared/sceneLoader.ts` |
| B — Sync/backend | `web/host/`, `web/play/`, `web/lib/firebase.ts`, `functions/`, `database.rules.json`, `storage.rules`, `firebase.json` |
| Contracts (both, change by agreement) | `shared/contracts.ts`, `shared/scoring.ts` |
| Content | `shared/scenes/*.json`, prompts, author ranks |
| Docs | `docs/`, this file, `.cursor/` |

Solo build (D-01): lanes are file-ownership areas, not people. Stay in one lane per session where you can; if you touch another, say so in the handoff.

## 8 rules agents break most
1. Each live param has **target** (network) and **current** (drawn); the 60fps loop eases current to target. Never draw network values directly.
2. **No generative AI in a live round.** Gemini/ElevenLabs run only after lock, via Functions, behind `/config/flags` with a canned fallback.
3. **Keys server-side only.** Nothing secret in `web/`, `shared/`, or git; `.env*` stays ignored.
4. **Tiny payloads.** A choice is `{optionId, uid, at}`; no streams, no images in RTDB.
5. **Host is the only writer of round state** (D-10); phones write only their own nick, choice, rating. Rules enforce it, not the client. Timer uses server time.
6. **No brand logos or trademarked characters** (no "Waffle House" logo, no Batman); generic original art only.
7. **Nothing outside P0–P3**; solo build, so the cut line is the solo cut line in BUILD_ORDER §8 (D-01). No accounts, uploads, whole-canvas undo, or abstractions we won't use this weekend.
8. **Deterministic rendering:** seed from `round.seed`; no `Math.random`/`Date.now` in the live layer. Photosensitivity caps (≤3 Hz flicker) live in presets and can't be overridden.

## Working style
Simplest thing that works; reuse before adding. Use `/verify` before saying done and `/handoff` at the end of a session.
