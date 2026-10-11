# HANDOFF

## Done this session
- **P1-6 code** ([BUILD_ORDER](BUILD_ORDER.md) §4): `web/screen/main.ts` `reveal()` + `web/screen/index.html` (`#bloom`, `#burst`, card slide). On lock: Web Audio thunk (90→45 Hz, 0.5 s). At `lockedAt + SETTLE_MS`, after the capture frame: one radial bloom (900 ms, peak 0.55), 60 dots seeded from `round.seed` (mulberry32), rising swell tone. Title card slides up 48 px from `locked` to `rating`.
- Earlier, not committed: P1-8 code (canned verdicts, `genFallbackClips.ts`), P1-4, P1-2.

## In progress / next
- **P1-6 manual check not done** (needs a browser round): see steps below.
- P1-8 clips still not generated/uploaded (needs ElevenLabs key; header of `functions/scripts/genFallbackClips.ts`).

## Verify status
- typecheck pass · lint pass · `npm test` pass · build pass (chunk-size warning, already there). Visuals and sound not yet looked at.

## Manual check (P1-6)
1. `/host`, start session, open `/screen/?s=CODE`; click once on the screen tab (unlocks audio).
2. Join 1+ bots/phones, run a 60 s round.
3. At 0:00: thunk, hush, then ~1.5 s later one soft flash + dot burst + swell; no repeat.
4. Title card slides up and reads from ~2 m; then rating and reveal as before.
5. Refresh /screen during `rating`: no bloom, no sound.

## Decisions / docs
- No D-nn added. Lane note: touched A (`web/screen/`) only. Cues are Web Audio blips, not the `.ogg` files in art-direction §7 (simplest for solo).

## Blockers / open items
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- `/screen` has no gesture, so SFX stay silent until the first click/keypress on it (art-direction says the host's Start click unlocks; different page). Visuals are unaffected.
- Bloom fires from `capture()` via `reveal()`; the judged JPEG is taken before it. Bloom is skipped if screen loads >1 s past settle.
- Burst canvas is sized once at fire time; no resize handling.
- Verdict audio plays only at `reveal`, so SFX never overlap it; no ducking added.
