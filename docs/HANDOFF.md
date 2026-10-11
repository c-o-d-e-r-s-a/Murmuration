# HANDOFF

## Done this session
- **P2 pick-order 3, poster** ([BUILD_ORDER](BUILD_ORDER.md) §8 P2, D-37, lane B): new `web/host/poster.ts` (2D canvas → PNG blob: title, prompt, Author/AI/Audience/Combined, `nick · role · option label` credits, `results.snapshotUrl` as artwork if it loads, seeded flock dots); `web/host/main.ts` adds a "Download poster" button, visible only in `reveal`. Nothing uploaded; no `/screen`, functions, rules, or play changes.
- Earlier (carried, not committed): P2 replay OG (`functions/src/replayOg.ts`), `/replay`, P1-10, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- **Manual check** of the poster (below), then the next P2 pick-order item (P2-4 narration audio).
- Still open: deployed OG check (`firebase deploy --only functions:replayOg,hosting`), `/replay` browser check; P1-10, P1-7, P1-6 manual checks; P1-8 clips.

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass. Poster not yet exercised in a browser.

## Decisions / docs
- None new. Poster follows D-37.

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing (402 → Reimagined fails, judge goes canned).
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Poster loads `snapshotUrl` with `crossOrigin=anonymous`; if the Storage bucket has no CORS config the image fails/taints and the poster silently falls back to the plain background. Fix = bucket CORS for the host origin.
- Poster only covers the current `reveal` round; archived rounds are not re-downloadable (button hides after New round).
- Hosting serves static files before rewrites; `/replay/?s=&r=` can never carry OG.
- `npm test` doesn't run `functions/src/*.test.ts`; run them by hand with `tsx`.
