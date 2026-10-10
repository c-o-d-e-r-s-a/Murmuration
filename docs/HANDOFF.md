# HANDOFF

## Done this session
- [P1-1](BUILD_ORDER.md) part 2 (solo §8): Gemini structured call + post-validation in `functions/src/judgeRound.ts`. P1-1 is code-complete.
  - `askGemini(models, facts, labels, jpeg)`: `@google/genai` 2.28.0 (pinned exact) `interactions.create` with the CONTRACTS §8 schema plus the inline JPEG; primary then fallback model inside one 12 s deadline (D-41); `null` means canned.
  - `parseVerdict`: JSON shape, score through `aiScore` (clamped), non-empty comment cut to 140 chars, 40–60 words, cites ≥ min(2, chosen) labels.
  - Facts are `scene.description`, `round.promptText`, the chosen labels and `unfilledRoles`. No title, nicknames or uids. Scenes come from `BUNDLED_SCENES`; a non-bundled scene gets canned.
  - Secret `GEMINI_API_KEY` via `defineSecret`; an empty key gives canned.
  - `functions/src/judgeRound.test.ts`: offline asserts; with the key it adds one live call and one forced failure. `functions/tsconfig.json` excludes `src/**/*.test.ts`.

## In progress / next
- Deploy: `npx -y firebase-tools@latest deploy --only functions` (add `,storage` if the Storage rules were never deployed). Then play one bot round to confirm a real AI score.
- Next task per [§8](BUILD_ORDER.md): P1-5 rotation, bots, refresh test, P1-9 Tiger mirror.

## Verify status
- Typecheck, lint, `npm test`, `vite build`, functions `tsc`, and the `sceneLoader` and `judgeRound` self-checks all pass.
- Live smoke: `gemini-3.8-flash` gave valid JSON in 9.7 s on a 1×1 JPEG. Rules unchanged, so the emulator was not run. No browser QA (function not deployed).

## Decisions / docs
- New D-41 (one 12 s budget, SDK path chosen over REST). ARCHITECTURE §4 still says `results/snapshotRequested`; the real key is `results/judgeRequestedAt`.

## Blockers / open items
- `meta.screenUid` is never written, so `/screen` must share the browser and hostname with `/host` (same uid).
- Latency: 9.7 s on a tiny image. A real 1280×720 snapshot may reach 12 s, leaving no time for the fallback model. If timeouts show in the logs, set `geminiModel` to `gemini-3.5-flash-lite` in flags (RISKS R5).

## Gotchas
- Live self-check: `npx tsx --env-file=functions/.secret.local functions/src/judgeRound.test.ts`. Without `--env-file` it runs offline only.
- `usage.judgeCalls` counts judged rounds, not API attempts; a fallback retry does not count twice.
- Deploy fails if the `GEMINI_API_KEY` secret is missing in Secret Manager (`firebase functions:secrets:set GEMINI_API_KEY`).
- Rules tests (Java 21, not on this PATH): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`.
