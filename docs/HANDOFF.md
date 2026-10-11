# HANDOFF

## Done this session
- **P1-8 code** ([BUILD_ORDER](BUILD_ORDER.md) §4/§8): 3 canned verdicts per demo scene in new `functions/src/cannedVerdicts.ts` (moved out of `judgeRound.ts`); one-shot generator `functions/scripts/genFallbackClips.ts` (ElevenLabs -> Storage `fallback/{sceneId}/{n}.mp3`, n=0..2, skips existing). `judgeRound.ts`: fallback URL now `fallback/{sceneId}/{n}.mp3`.
- Rule (stable): `n = sha256(roundId)[0] % clips`, so the canned text and clip match; same n used when Gemini works but TTS fails (text and clip then differ).
- Earlier: P1-4 audio UI, P1-2 backend (not deployed, not committed).

## In progress / next
- **Clips NOT generated/uploaded yet** (no key/credentials in this session). Run the generator (header of the script), then deploy functions and do the manual check.

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning, already there). Script type-checked standalone. Playback and Storage not tested.

## Decisions / docs
- No D-nn added. Lane note: touched B (`functions/`) only.

## Blockers / open items
- Needs `ELEVENLABS_API_KEY`, a service-account JSON (gitignored), and bucket name; carried: hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Script uses env vars only (`ELEVENLABS_API_KEY`, `STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`); run with `npx tsx` from repo root. Uploads set a download token (needed by `getDownloadURL`).
- Editing a canned script means re-running with `--force` for that scene.
- Unknown sceneId has only the `default` text and no clip (`audioUrl: null`).
- Plays once per round+url, only at `reveal`; "Play verdict" button shows if autoplay is blocked.
