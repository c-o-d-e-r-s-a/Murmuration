# HANDOFF

## Done this session
- [P1-1](BUILD_ORDER.md) part 1 (solo §8): `judgeRound` with flags, cap, snapshot to Storage, canned verdict, idempotency; T4a on `/screen`.
  - `functions/src/judgeRound.ts` (new), `functions/src/index.ts` (`initializeApp`, exports `judgeRound`).
    Guards: auth uid is `meta.hostUid` or `meta.screenUid`; `round.id == roundId`; status `locked`/`rating`; refuses if `results.ai` exists; base64 ≤ 1.5 MB and JPEG magic bytes.
    Snapshot goes to `snapshots/{code}/{roundId}.jpg` with a download token, URL in `results.snapshotUrl` (an upload failure is logged and skipped).
    If `aiEnabled` and `usage.judgeCalls < maxJudgeCallsPerSession`, it increments `meta/usage/judgeCalls` (Gemini goes there later). Every path then writes canned `ai {score 6, model "canned", fallback}` via a transaction plus `verdict {script, audioUrl null, ready true, fallback}`.
  - Canned comment and script per scene (rush-hour, diner, vigilante, default; 53–57 words each) are the `CANNED` map in `judgeRound.ts`.
  - `web/screen/main.ts` `judge()`: waits until `lockedAt + SETTLE_MS`, rechecks round id and status, claims `results/judgeRequestedAt` with `runTransaction`, then calls the callable. Errors are swallowed.
  - `web/lib/firebase.ts`: exports `functions`, `httpsCallable`, `runTransaction`.
  - D-40: `Scene.description` in `shared/contracts.ts`; the loader requires it; rush-hour got "a gridlocked highway at dusk"; one new loader test; the judge-script skill input line now says `scene.description`.

## In progress / next
- [P1-1](BUILD_ORDER.md) part 2: Gemini structured call + post-validation at `TODO(P1-1 part 2)` in `functions/src/judgeRound.ts`. Needs a Functions secret, `BUNDLED_SCENES` in functions (for labels and description; add `resolveJsonModule` if tsc complains), a `GEMINI_TIMEOUT_MS` race, and a retry with the fallback model.
- The function is **not deployed**: `npx -y firebase-tools@latest deploy --only functions` (plus `storage` if the rules were never deployed).

## Verify status
- Typecheck, lint, `npm test`, `vite build`, functions `tsc` and the `sceneLoader` self-check pass. Rules unchanged. The rules emulator was not run because Java is not on this shell's PATH. No browser QA yet.

## Decisions / docs
- No new D-nn. ARCHITECTURE §4 still says `/screen` writes `results/snapshotRequested`; the real key is `results/judgeRequestedAt`.

## Blockers / open items
- `meta.screenUid` is never written. `/screen` only works as judge caller in the **same browser and same hostname** as `/host` (same uid). It passes because `results/.write` already grants the host uid, and the child rule cannot revoke that.
- Prod flags have `aiEnabled: true`, so `usage.judgeCalls` counts mocked calls; the verdict is still canned.

## Gotchas
- `/host` must stay open (a Blob worker tick keeps it running in the background).
- Two identities in one browser: `localhost` vs `127.0.0.1`. A `/screen` on the other hostname can't claim the judge, so the reveal waits for the 25 s cap and shows "judge offline".
- The host uid can overwrite `judgeRequestedAt` (the parent grant), so idempotency comes from the client transaction plus the function's `results.ai` transaction.
- Rules tests (Java 21): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`.
