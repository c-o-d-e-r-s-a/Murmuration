# HANDOFF

## Done this session
- **P1-7 part 1, backend** ([BUILD_ORDER](BUILD_ORDER.md) §4): new `functions/src/reimagineRound.ts`, exported from `functions/src/index.ts`. Checks host uid, `round.status == "reveal"`, flag/cap/key/scene; claims `results.reimagined` in a transaction (`pending`, or `skipped` if not allowed; a repeat call returns the existing status). It then reads `snapshots/{code}/{roundId}.jpg`, bumps `usage.reimagineCalls`, makes one `interactions.create` image call (`flags.imageModel`, `REIMAGINE_TIMEOUT_MS`), saves to `reimagined/{code}/{roundId}.png`, and writes `ready` + url. No snapshot or a timeout gives `skipped`; any other error gives `failed`. The final write only lands if the round id is the same and the status is still `pending`.
- `web/host/main.ts`: after the T5 write succeeds, next to `logTiger`, `reimagine(id)` reads `config/flags/reimagineEnabled` once and, if true, fires the callable without awaiting (client timeout 90 s; errors only go to `console.warn`).
- `functions/src/reimagineRound.test.ts`: offline prompt checks; one live image call when `GEMINI_API_KEY` is in the env.
- Carried, not committed: P1-6, P1-8 code, P1-4, P1-2.

## In progress / next
- **P1-7 manual check** (deploy functions + hosting, bot round with the flag on and off). Steps are in the session report.
- Then **P1-7 part 2 = B3** side-by-side panel in `web/screen/main.ts` (listens to `results.reimagined`), and prompt tuning on a real snapshot.
- Still open: P1-6 manual check, P1-8 clips (need the ElevenLabs key).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (same chunk-size warning) · `functions` tsc pass · offline self-check pass. No live image call made (it costs money).

## Decisions / docs
- No D-nn added. The Verify column says "flag false → skipped", but the host doesn't call when the flag is off, so `results.reimagined` stays **absent**. The function writes `skipped` only if it is called while the flag is off. B3 should treat "absent" the same as `skipped`.
- One model per call. `imageFallbackModel` is not tried automatically; swap it by hand via flags (RISKS R8).
- Lanes: B only (`functions/`, `web/host/`).

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing on the Blaze project (SETUP §3 step 5). With a $0 balance you get 402: Reimagined fails, **and the judge drops to canned too**.
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- The model may return JPEG bytes. The file is still `.png` (per DATA_SCHEMA), but the `contentType` comes from the reply's mime type, so browsers render it fine.
- If the host refreshes during `reveal`, T5 does not fire again, so Reimagined is never called for that round.
- T6 copies `results` into the archive while the status may still be `pending`; a later `ready` is not copied into the archive.
- The SDK's timeout error name is assumed to be `TimeoutError`/`AbortError`; if the SDK wraps it, a timeout reads as `failed`.
