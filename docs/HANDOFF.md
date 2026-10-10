# HANDOFF

## Done this session
- **P1-2 backend** ([BUILD_ORDER](BUILD_ORDER.md) §4/§8): ElevenLabs in `functions/src/judgeRound.ts`. Writes `results.verdict{script, ready:false}`, then `verdictAudio()` (cache `verdicts/{sha256(script)}.mp3` → ElevenLabs ≤ `TTS_TIMEOUT_MS` → Storage, else `fallback/{sceneId}/0.mp3`, else null), then `{audioUrl, ready:true}`. `ELEVENLABS_API_KEY` added to the function's secrets. `meta.usage.ttsChars` += script length right before each ElevenLabs call.
- `functions/src/judgeRound.test.ts`: live `ttsMp3` check (real clip + bad voice → null) when the key is in env.
- Not deployed, not committed.

## In progress / next
- Deploy functions and run the P1-2 manual check (cache hit on a repeated canned script with `aiEnabled=false`, `voiceEnabled=true`).
- Then A2 / P1-4 playback on `/screen` (`web/screen/main.ts`) reads `results.verdict.audioUrl`; or P1-10.

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning, already there).
- `judgeRound.test.ts` live: Gemini 11.8 s ok; TTS `eleven_v4_turbo` 1.1 s, 21 KB mp3; bad voice id → null.
- Secret `ELEVENLABS_API_KEY` v1 ENABLED in Secret Manager.

## Decisions / docs
- None added. Two judgement calls (could be D-nn): cache is checked **before** the TTS char cap (cache hits are free); `verdict.fallback` still means "canned script", not "fallback audio".

## Blockers / open items
- Carried: hidden-/screen-at-lock gap (no judge call, no verdict), `meta.screenUid`, real-phone LAN, custom-domain auth.
- No `fallback/{sceneId}/0.mp3` clips yet (P1-8/A3), so the fallback path yields `audioUrl: null`.

## Gotchas
- With a live Gemini script and TTS off/failed, the fallback clip (canned audio) won't match the on-screen script text (RISKS §2 accepts this).
- Worst case is Gemini 12 s + TTS 10 s after snapshot upload, which can pass the 25 s rating cap; the host then reveals with `ready` false and the verdict lands late.
- Cache key is the script only: changing `ttsVoiceId`/`ttsModelId` reuses old clips for identical (canned) scripts. To regenerate, delete `verdicts/*`.
- Fallback/cached URLs need a download token; files uploaded with `gsutil` (no token) come back as null. Upload via the console.
