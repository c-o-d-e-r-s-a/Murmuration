# HANDOFF

## Done this session
- [P1-3](BUILD_ORDER.md) Spectator rating UI + "You made this" card (solo §8, lane A + B host button; no contracts/rules/package changes).
- `web/play/main.ts`: in `rating`, Spectators get five write-once buttons 1–5 (`set ratings/{uid}`, listens only to own `ratings/{uid}`, "Thanks" after). Creators get a card (role badge in role hue, chosen option label, "Scores on the big screen") through `rating` and `reveal` (D-14).
- `web/host/main.ts`: "Add 10 spectator bots" (`addBots(10, true)`); `tickBots` makes bot Spectators vote 3–5 during `rating` (30% chance per tick, once per bot per round; host-written, allowed by rules).
- Fix after user test: the host tick now runs from a Blob Web Worker, not `setInterval`. A hidden `/host` tab (same browser as `/screen`) was throttled, so T3/T4/T5, bot votes, and scores stalled until the host tab was focused.

## In progress / next
- User to re-test: `/host` and `/screen` as tabs in one browser, stay on `/screen`; round should lock → rate → reveal on time, bot votes land, scores show on `/host`.
- Next task: [P1-4](BUILD_ORDER.md) three-score reveal on `/screen` (today scores appear only on `/host`'s score line; `/screen` has no rating rail or score cards).
- `TODO(P1-1)` in `web/screen/main.ts` (judgeRequestedAt + judgeRound).

## Verify status
- `/verify`: typecheck, lint, `npm test`, build pass. Rules untouched; emulator test not rerun (last: 36 assertions pass). Worker fix not yet browser-verified.

## Decisions / docs
- No new D-nn. Creators' phone shows the card, not the artwork (by design: no images in RTDB); user may want the image or scores on the phone later. That would be new scope, so ask first.

## Blockers / open items
- Real-phone QR run over LAN not done (`npm run dev -- --host`).
- `.cursor/skills/judge-script/SKILL.md` still says input "scene" (should be `scene.description`).
- Rating window always runs to the 25 s cap until P1-1 sets `verdict.ready`.

## Gotchas
- `/host` must stay open (a background tab is fine now; closing it or freezing the window stops the round).
- Bot Spectators = bots with no slot; they vote only while `round.status == "rating"`. Role is re-derived from slots at START.
- Two identities in one browser: `localhost` vs `127.0.0.1`.
- Rules tests (Java 21): `npx -y firebase-tools@latest emulators:exec --only database "npx tsx database.rules.test.mts"`.
- Mid-live host refresh runs missed steps in one frame (hitch by design).
