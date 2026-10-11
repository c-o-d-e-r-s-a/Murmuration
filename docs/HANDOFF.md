# HANDOFF

## Done this session
- **P2 pick-order 2, replay OG preview** ([BUILD_ORDER](BUILD_ORDER.md) §5/§8, lane B): new `functions/src/replayOg.ts` (`onRequest`, us-central1) + `replayOg.test.ts`, exported from `functions/src/index.ts`; `firebase.json` hosting rewrite `/replay/*/*` → `replayOg`.
- Share link is now **`/replay/CODE/rN`** (D-30 form). Crawler User-Agent → HTML with og:title (`<scene title> — <prompt>`), og:description, og:url, og:image (`results.snapshotUrl`, omitted if missing), twitter card. Any other UA → 302 to `/replay/?s=CODE&r=rN` (static app, unchanged).
- Docs: CONTRACTS §9 (share-link shape + why), ARCHITECTURE route table + deploy line.
- Earlier (carried, not committed): P2 `/replay` page, P1-10, P1-7 parts 1–2, P1-6, P1-8 code, P1-4, P1-2, P1-9.

## In progress / next
- **Deployed manual check**: `firebase deploy --only functions:replayOg,hosting` → `curl.exe -A "Twitterbot/1.0" https://<host>/replay/CODE/rN` shows og tags → same URL in Chrome lands on `/replay/?s=CODE&r=rN` and plays. Then paste into Discord/Slack.
- Still open: `/replay` browser check; P1-10, P1-7, P1-6 manual checks; P1-8 clips (ElevenLabs key).

## Verify status
- typecheck pass · lint pass · `npm test` pass · `replayOg.test.ts` pass (by hand) · build pass (chunk-size warning only) · functions `tsc` pass.
- Emulator (hosting+functions+database, seeded fake archive): Twitterbot → og tags; Chrome UA → 302 to the query URL; missing round → title "Murmuration", no image; `/replay/?s=&r=` → static app 200.

## Decisions / docs
- No new D-nn; the chosen shape resolves the D-30 vs CONTRACTS §9 URL mismatch (path = share link, query = app URL). Recorded in CONTRACTS §9.

## Blockers / open items
- Gemini image calls need AI Studio Prepay billing (402 → Reimagined fails, judge goes canned).
- Carried: ElevenLabs key, hidden-/screen-at-lock gap, `meta.screenUid`, real-phone LAN, custom-domain auth.

## Gotchas
- Hosting serves static files before rewrites: `/replay/?s=&r=` can never carry OG; only the path form does. Nothing generates the share link yet (no link on `/host`); type it by hand.
- Hosting → function rewrites only work for us-central1; keep `replayOg` there.
- Bot detection is a UA regex (`BOT_RE`); an unlisted crawler gets the 302 and sees the static page's plain `<title>`.
- `og:url` uses `x-forwarded-host`; on the custom domain it should be that domain (unverified).
- OG responses cache 5 min (`Cache-Control: public, max-age=300`), so a re-archived round updates after that.
- `npm test` doesn't run `functions/src/*.test.ts`; run them by hand with `tsx`.
