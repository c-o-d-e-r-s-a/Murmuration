# HANDOFF

## Done this session
- **P1-7 part 2, /screen panel** ([BUILD_ORDER](BUILD_ORDER.md) §4): `web/screen/main.ts` `syncReimagined(url)` + `web/screen/index.html` (`.reimagined`, `.rx` CSS). In reveal, when `results.reimagined.status==="ready" && url`, the image is preloaded. On load, the stage eases from scale 0.6 to 0.3 (transform only) and the image fades in beside it over 900 ms, with a small-caps "Reimagined with Gemini" tag (D-43). Absent, pending, failed, skipped or an image load error change nothing: no placeholder, no spinner. Passive, no writes. Verdict transcript removed from `/screen` (audio + Play stay).
- Earlier (carried, not committed): P1-7 part 1 backend (`functions/src/reimagineRound.ts`, host call in `web/host/main.ts`), P1-6, P1-8 code, P1-4, P1-2.

## In progress / next
- **P1-7 manual check** (deploy functions + hosting; bot round with `reimagineEnabled` true, then false). Steps are in the session report.
- Prompt tuning on a real snapshot.
- Still open: P1-6 manual check, P1-8 clips (need the ElevenLabs key).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (same chunk-size warning). Panel not eyeballed in a browser, because no real `ready` url was available.

## Decisions / docs
- **D-43:** `/screen` verdict is voice-only (no transcript); Reimagined chip reads "Reimagined with Gemini". Art-direction §3/§6 Beats 8–10/§10 updated.
- **Layout choice, not a D-nn:** Beat 10's 50/50 fights the scoreboard; artwork scales to 0.3, image at 33–59vw left of the board.
- "Absent" is treated as `skipped` (flag off means the host never calls).
- Lane: A (`web/screen/`).

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing (402 makes Reimagined fail and the judge go canned too).
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Reveal starts with the board and artwork at 0.6, so the shrink to 0.3 is visible when the image arrives later. This is intended (transform only, no flicker).
- The image box assumes a 16:9 artwork canvas and a roughly 16:9 viewport. Check at 1280×720.
- Host refresh in `reveal` means T5 doesn't re-fire, so there is no Reimagined for that round. T6 archives `results` before a late `ready` lands.
- Verdict transcript is gone from `/screen` (D-43); if Play still sits under the image, nudge `.play-verdict`.
