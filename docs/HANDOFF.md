# HANDOFF

## Done this session
- **P2 pick-order 4, narration** ([BUILD_ORDER](BUILD_ORDER.md) §8 P2, lane B): new `functions/scripts/genNarration.ts` (one-shot ElevenLabs → Storage `narration/demo-walkthrough.mp3`, same pattern as `genFallbackClips.ts`); `web/host/main.ts` adds a "Play narration / Stop narration" button (click only, plain `Audio`, public `?alt=media` URL, no token). No play/screen/rules/functions-runtime/flags changes.
- Earlier (carried, not committed): P2 poster (D-37), replay OG, `/replay`, P1-10, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- **Run the generator once** (needs ElevenLabs key), then manual check below.
- Next P2 pick-order item per BUILD_ORDER §8.
- Still open: deployed OG check (`firebase deploy --only functions:replayOg,hosting`), `/replay` browser check; P1-10, P1-7, P1-6 manual checks; P1-8 clips; poster manual check.

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass. Narration not yet exercised in a browser (mp3 not generated).

## Decisions / docs
- None new. No flag added (button is ungated; no external call at play time).

## Blockers / open items
- ElevenLabs key (generator). Gemini image calls need AI Studio billing (402 → canned judge).
- Carried: hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Narration URL is hardcoded to bucket `murmuration-33d60.firebasestorage.app`; if the bucket changes, update `web/host/main.ts`. If the file isn't uploaded, the button shows "narration not available".
- Audio plays on the host device only (not /screen), so route host audio to the room speakers.
- Poster needs bucket CORS for the snapshot image; `npm test` doesn't run `functions/src/*.test.ts`.
