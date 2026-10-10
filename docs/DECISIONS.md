# DECISIONS — settled choices for Murmuration

> Every decision that constrains the build. If something here changes, update this file first, then the doc it affects.
> Source of truth for *what and why*: [00-brief.md](00-brief.md). Source of truth for *how*: the other docs in this folder.

Format: **D-nn — decision.** Why. (Affects: docs.)

## Team and scope

- **D-01 — Solo developer; the solo plan is the active plan.** No teammate joined. [BUILD_ORDER §8](BUILD_ORDER.md) is the plan and its solo cut line replaces "end of P1" from D-03; §1–§7 stay as the 2-dev reference for ordering, tasks, and verify steps. Lanes in AGENTS.md are file-ownership areas, not people. (Affects: BUILD_ORDER, AGENTS.md.)
- **D-02 — No external credentials exist at planning time.** Every external call (Gemini, ElevenLabs, Tiger Data) sits behind a flag in `/config/flags` and has a canned fallback, so the demo never depends on a key arriving. (Affects: ARCHITECTURE, RISKS.)
- **D-03 — Cut line is end of P1.** P2 items are picked by value/cost only if ahead. P3 Scene Studio is a roadmap slide unless P2 is done by hour 30. Because "Best Use of Tiger Data" is an announced prize, the Tiger Data mirror of the RTDB event log plus a small "session pulse" panel on `/host` is the **last item of P1** (P1-9, P1-10); the GoDaddy domain is a **hour-0 task** since the prize is for the name. (Affects: BUILD_ORDER, ARCHITECTURE.)

## Platform

- **D-04 — Firebase Realtime Database only; no Firestore.** One database, lowest write latency, `now` available in rules for server-time guards, `onDisconnect` for presence, `.info/serverTimeOffset` for clock skew. (Affects: ARCHITECTURE, DATA_SCHEMA.)
- **D-05 — All-Firebase hosting: Firebase Hosting + Cloud Functions (2nd gen, `onCall`) + Cloud Storage + Anonymous Auth.** One console, one `firebase deploy`. Vercel/Netlify dropped. Functions and Storage require the Blaze plan; enable at hour 0. (Affects: ARCHITECTURE, BUILD_ORDER.)
- **D-06 — Frontend: Vite multi-page app in TypeScript (loose, no strict mode), pages `/screen`, `/play`, `/host`, `/dev`, `/replay`.** A `shared/` package (contracts, presets, scenes, scoring) is imported by all pages and by `functions/`. (Affects: ARCHITECTURE, CONTRACTS.)
- **D-07 — p5.js pinned to the latest 1.x release.** 2D renderer for the live canvas; WEBGL only if the reveal needs a shader (optional). (Affects: ARCHITECTURE.)
- **D-08 — Realtime payloads are tiny and discrete.** Creators pick one of four options per role; a choice write is `{optionId, uid, at}`. No drag streams in P0. The brief's 100–150 ms throttle applies only to the P2 Spectator energy dial. (Affects: CONTRACTS, RISKS.)
- **D-35 — Node 24 for local dev and Functions (`engines.node: "24"`).** Node 20 is end-of-life (April 2026) and `firebase init` scaffolds 24. (Affects: SETUP, ARCHITECTURE, BUILD_ORDER.)

## Session and roles

- **D-09 — Multi-session with a 4-character code in the QR URL** (`/play?s=ABCD`). Stale scans cannot pollute a new session. (Affects: DATA_SCHEMA.)
- **D-10 — `/host` is the single writer of round state** (status, timestamps, slots, queue, scene choice, prompt). `/screen` is passive except for the snapshot upload and `judgeRound` call. Phones write only their own nickname, their own role's choice, and their own rating. (Affects: ARCHITECTURE, ROUND_STATE_MACHINE, DATA_SCHEMA.)
- **D-11 — Host controls live on a separate `/host` route** in a second browser window on the laptop; `/screen` goes fullscreen on the same laptop display (D-38). (Affects: ARCHITECTURE.)
- **D-38 — No projector: `/screen` targets the host laptop's own display; `/play` targets phones.** The audience is a small group within ~2 m of the laptop, each holding a phone. `/screen` runs fullscreen (F11) on the built-in display: CSS viewports from 1280×720 to 1920×1080 (a 1080p panel at 100–150% Windows scaling; 16:10 panels letterbox). Design reference stays 1920×1080 and scales with `vw`/`vh`. Glare and off-axis viewing lift blacks the way a projector did, so the contrast floors stay. `/host` is a second window on the same laptop (Alt+Tab) and is never what the room is meant to see. `/play` keeps the 390 px phone reference. The laptop drives `/screen` and `/host` at once, so the 60 fps budget is measured there. (Affects: brief, art direction, ARCHITECTURE, RISKS, BUILD_ORDER.)
- **D-12 — Role queue is the source of truth for rotation.** Initial order = join order; host overrides edit the queue; after each round the Creators move to the back. Slot fill priority: palette, form, motion, texture, mood. A round starts with at least 3 slots filled (bots count). (Affects: ROUND_STATE_MACHINE, CONTRACTS.)
- **D-13 — Round duration default 90 s; host may choose 60 / 90 / 120.** (Affects: CONTRACTS.)
- **D-14 — Spectators rate with five large buttons (1–5), stored as the integer, displayed and combined on a 10-point scale.** Creators do not rate; they see a "you made this" card. One vote per device, write-once. (Affects: CONTRACTS, DATA_SCHEMA.)
- **D-15 — Rating window is adaptive: minimum 12 s, extends until the verdict audio is ready, hard cap 25 s, then a fallback verdict plays.** Resolves the brief's 10–15 s window vs. verdict-latency conflict. (Affects: ROUND_STATE_MACHINE, CONTRACTS.)

## Scenes and rendering

- **D-16 — Base art is SVG path data (`d` strings with fill/stroke) stored in the scene JSON**, drawn once to an offscreen layer through `drawingContext` + `Path2D`. Hotspots are tagged paths. Scene Studio strokes (P3) are stored as polylines and converted to the same path form. (Affects: DATA_SCHEMA, ARCHITECTURE.)
- **D-17 — One shared preset library owns all render parameters.** Every option, demo or custom, is `{id, presetId, label, authorScore, overrides?}`. Demo scenes may add `overrides` and hotspots; custom scenes may not. Photosensitivity caps (flicker ≤ 3 Hz, no full-screen strobe) are enforced inside the library and cannot be overridden. This is the only place P3 touches P0. (Affects: DATA_SCHEMA, CONTRACTS.)
- **D-18 — Author scores are a ranking mapped to 10 / 7 / 4 / 1.** Round Author score = mean over filled roles. (Affects: CONTRACTS.)
- **D-19 — Demo scenes ship as JSON bundled in `shared/scenes/`.** The same loader accepts a scene object from RTDB `/scenes/{id}` (P3). (Affects: ARCHITECTURE.)
- **D-20 — Rendering is deterministic: `randomSeed`/`noiseSeed` from `round.seed`; the live layer is a pure function of (scene, seed, current params, time since start).** This enables replay and lets a refreshed `/screen` re-render and re-capture the locked frame. (Affects: ARCHITECTURE, ROUND_STATE_MACHINE.)
- **D-21 — Snapshot is a 1280×720 JPEG (quality 0.8) captured by `/screen` at lock**, sent to `judgeRound` as base64, stored in Cloud Storage by the function. (Affects: CONTRACTS.)

## AI and voice

- **D-22 — One Gemini call per round returns `{score, comment, script}`** as structured JSON (judge and verdict script together). Halves latency and quota; the model already has the image and facts. Fallback: canned score/comment/script per scene. (Affects: CONTRACTS, RISKS.)
- **D-23 — The verdict script does not cite the audience score** (it is generated during the rating window, before that score exists). It cites the AI's own view and at least two chosen options by label. (Affects: CONTRACTS.)
- **D-24 — Nicknames are never sent to Gemini or ElevenLabs.** Roast the art, never individuals, by construction. (Affects: CONTRACTS, RISKS.)
- **D-25 — Verdict audio is cached in Cloud Storage keyed by SHA-256 of the script**; per-scene pre-generated fallback clips are produced the moment an ElevenLabs key exists. Mute toggle on `/host`. (Affects: ARCHITECTURE, RISKS.)
- ~~**D-26** Firefly Reimagined via structure reference.~~ Superseded by D-36.
- ~~**D-27** Adobe Express poster if approved.~~ Superseded by D-37.
- **D-28 — Gemini model: `gemini-3.8-flash` for judge/script/moderation, `gemini-3.5-flash-lite` as the cheap fallback.** The Gemini docs currently show an `interactions.create` + `response_format` surface in `@google/genai`; pin the SDK version and smoke-test one structured call at hour 0; keep a plain REST fallback. (Affects: CONTRACTS, RISKS.)

## Demo, replay, ops

- **D-29 — Demo mode = host-driven bots inside the real session.** `/host` has "Add bots" which writes simulated Creator choices and Spectator ratings under bot uids; rules grant the host uid write access to those paths. `/dev` is a standalone slider harness for the renderer. (Affects: ARCHITECTURE, DATA_SCHEMA.)
- **D-30 — Event log lives in RTDB under the round** (`events/{push}` = `{t, role, optionId}`); `/replay/{code}/{roundId}` replays it through the same renderer. Tiger Data mirror is optional (see D-03). (Affects: DATA_SCHEMA, CONTRACTS.)
- **D-31 — Security rules are the enforcement layer, not the client.** Every writable path has `.write` on `auth.uid` and `.validate` on shape, size, and `now`-based time windows. Rules are tested in the emulator before P1 starts. (Affects: DATA_SCHEMA, BUILD_ORDER.)
- **D-32 — Always-deployable `main`, tagged known-good builds** `v0-p0` (hour 18) and `v1` (hour 29). Feature freeze at hour 30; final deploy at hour 34. (Affects: BUILD_ORDER.)

## Sponsor tracks (Hacklanta prizes, announced)

- **D-33 — Pursue four sponsor tracks, decline three.**
  - **Pursue: ElevenLabs** (verdict voice, fallback clips, narration; already P1), **Gemini API** (judge + script + Reimagined render, P3 moderation; already P1, D-36), **Tiger Data** (event-log mirror + session pulse panel; P1-9/P1-10, see D-03), **GoDaddy Registry** (joke-direction domain `mybossdoeslameicebreakers.work` registered at GoDaddy; used as the QR destination).
  - **Decline: Solana.** The only honest hook is minting the artwork as an NFT, which the brief excludes (§14 "Not using", §17). **Decline: Vultr.** All-Firebase stack (D-05); a second host adds a deploy pipeline and a failure point to a live demo, and the only truthful use (a worker for the Tiger mirror) is already a Cloud Function. **Decline: Auth0.** No participant accounts (brief §5, §17); host and author are guarded by anonymous uid, and a login step on `/host` adds friction to the page that must never fail on stage.
  - Tiger is never on the live path: RTDB stays the source of truth; Tiger is a derived store written after reveal with a short timeout and read only by the host panel. (Affects: ARCHITECTURE, CONTRACTS, DATA_SCHEMA, BUILD_ORDER, RISKS, SETUP.)
- **D-34 — Domain name is joke-direction** (pitch line, not product name): `mybossdoeslameicebreakers.work`, registered at GoDaddy. Setup steps live in [SETUP.md](SETUP.md). (Affects: SETUP, BUILD_ORDER.)
- **D-36 — The Reimagined render uses Gemini image editing, not Adobe Firefly.** Adobe could not issue Firefly credentials at the event, and Adobe sponsors the Creative track without a product challenge, so no Adobe integration is required. After reveal, `reimagineRound` sends the stored snapshot plus a prompt built from the round (generic scene description, palette label, mood word, "keep the composition") to `gemini-nano-banana-2.1` (fallback `gemini-3.1-flash-lite-image`) through the same `interactions.create` surface as the judge, with `response_format: {type: "image", aspect_ratio: "16:9"}`. The returned base64 image goes to Storage; only its URL goes to RTDB. Same flag, per-session cap, and 60 s skip as before; never on the reveal's critical path. Gemini has no structure-strength knob, so composition is held by the prompt alone; if prompt tuning cannot hold it, the backup is Flux image-to-image via fal.ai behind the same function contract (one new secret). Strengthens the Gemini track: Gemini judges, writes the verdict, and reimagines. (Affects: CONTRACTS, ARCHITECTURE, DATA_SCHEMA, SETUP, RISKS, BUILD_ORDER.)
- **D-37 — No Adobe Express poster.** The poster is a p5-rendered PNG (title, prompt, three scores, credits) downloaded from `/host` (P2). No Adobe console project, client id, or domain allowlist. (Affects: BUILD_ORDER, RISKS, SETUP.)

- **D-39 — Solo P0 scene picker reads bundled scenes; RTDB gallery is P3.** `/host` lists `BUNDLED_SCENES` (rush-hour, diner, vigilante); no `/gallery` node. (Affects: BUILD_ORDER, DATA_SCHEMA.)
- **D-40 — Brand-title exception.** Only the `title` field of the diner and vigilante demo scenes may read "Waffle House at 3 AM" and "Batman in Atlanta". Ids, art, labels, and prompts stay generic. `/verify` allows these two titles. `scene.title` is never sent to Gemini or ElevenLabs; AI prompts use the scene's generic `description` ("a roadside diner at night", "a caped vigilante over a city skyline"). (Affects: CONTRACTS §8 judge input + Reimagined prompt, D-36, AGENTS.md rule 6.)

## Open items (to be settled at the event)

- ~~**O-01** Sponsor prizes/challenges~~ Resolved by D-33.
- **O-02** Which keys arrive and when: flips `/config/flags`. ElevenLabs, Vultr, and GoDaddy codes are claimable now; Gemini via MLH credits (image output may need billing on; see SETUP §3).
- ~~**O-03** Projector resolution and laptop GPU~~ Resolved by D-38: no projector; `pixelDensity` cap stays 1.5; particle ceiling is measured on the demo laptop in `/dev` (A5).
- **O-04** Final scene names and jokes (team may rename; structure is fixed).
- ~~**O-05** ElevenLabs voice id and low-latency model id~~ Resolved: voice "Ed – Sarcastic Funny narrator" `3IwIPyXc0WRkgKBE8KXP`, model `eleven_v4_turbo` (fallback `eleven_flash_v2_5`); stored in `/config/flags` (`ttsVoiceId`, `ttsModelId`). See [SETUP §2](SETUP.md).
