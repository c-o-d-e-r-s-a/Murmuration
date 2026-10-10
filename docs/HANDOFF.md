# HANDOFF

## Done this session
- Verification only: RISKS R7 / [ROUND_STATE_MACHINE §5](ROUND_STATE_MACHINE.md) recovery cases on deployed build, session `XUTV` (60 s, 3 Creators incl. 1 human phone @390 px, 10 bot Spectators). 4 rounds (r1–r4). Gates [BUILD_ORDER](BUILD_ORDER.md) §8 R7 row.
- No source changes, no commit. `/config/flags/aiEnabled` toggled false for r4 and restored to `true`.

## In progress / next
- **P1-10** pulse panel (`sessionPulse`) — [BUILD_ORDER](BUILD_ORDER.md) §8.
- Decide on the hidden-/screen gap below (needs a D-nn).

## Verify status (R7)
| # | Case | Result |
|---|---|---|
| 1 | Host refresh live / locked / rating / reveal | **pass** (statusVersion +1 per step: 4, 9, 14, 19 at each reveal; no 2nd judge) |
| 2 | Screen refresh live / locked / rating / reveal | **pass**; locked-before-SETTLE only (reload >1.5 s). Reveal frames identical; `judgeRequestedAt` set once, 1 `judgeRound` call (r2, r4) |
| 3 | Phone refresh Creator mid-live, Spectator mid-rating | **pass** (same UI, pick highlighted; rating stays 4, buttons disabled) |
| 4 | Host refresh at reveal → New round | **pass** rotation once (+1, one archive). Tiger row count **not checked** (no DB access); exactly 1 `logRoundEvents` call per reveal |
| 5 | `aiEnabled=false` | **pass** canned ai+verdict (`fallback:true`), reveal 13.8 s after lock |
| 6 | Host tab hidden whole round | **pass** (r2/r4 ran with `/screen` in front; visibility not read directly) |

## Decisions / docs
- None added. Gap below likely needs a D-nn (+ ROUND_STATE_MACHINE §5 note).

## Blockers / open items
- **Gap (not fixed):** `/screen` hidden/absent at lock → capture never runs (rAF), `judgeRequestedAt` never set, no canned fallback; reveal at 25 s cap with AI "–" and no verdict (r1, r3). Small fix lives in Lane B (`functions/`/host) or Lane A (`web/screen/main.ts`): e.g. host writes canned `ai`/`verdict` at the cap if `judgeRequestedAt` is null.
- Cosmetic: at ~512 px width the reveal "COMBINED" label overlaps the credits row (`web/screen/`).
- Carried: real-phone LAN, P1-2 audio, `meta.screenUid`, custom-domain auth.

## Gotchas
- Host and `/screen` in one browser: only one is visible; `/screen` must be in front at lock for the judge. Host still ticks (worker).
- Rotation keeps a lone human Creator (humans queue before bots); to test Spectator, unassign in lobby and give the slot to a bot.
- Browser tool `viewId` is ignored; select the tab by index first. `firebase database:get` via CLI works (~25 s each).
- Test session `XUTV` left at r4 reveal; older `NHET`, `M2DS` may exist.
