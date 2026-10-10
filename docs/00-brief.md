# 00 — Project Brief: Murmuration (working title)

> **Purpose of this file:** the single source of truth for what we are building and why.
> It describes the **what, why, and constraints**, not the implementation. Do not write
> source code from this file. Follow the instructions in the last section.

---

## 1. Context

We are building this at a **36-hour hackathon** (Hacklanta, Atlanta, Creative track presented by Adobe), with a small team using Cursor. **Development must be fast.** Prefer the simplest thing that works, managed services over custom infrastructure, and one data-driven scene system over special-casing. Do not over-engineer, and do not build abstractions we will not use this weekend.

**Unknown until the event starts (do not assume answers):** official judging criteria, sponsor challenges, and venue WiFi quality.

---

## 2. Concept in one paragraph

A live, in-person, cooperative art game. A host shows a QR code on their laptop screen. People scan it with their phones (no app, no account). The first few joiners become **Creators**, each owning **one dial** of a **single shared artwork** (palette, form, motion, texture, mood word). Everyone else is a **Spectator**. A task prompt appears, a 1–2 minute timer runs, and as Creators change their choices the shared canvas on the laptop screen evolves live and smoothly. When time hits zero the piece locks and is revealed. Three "judges" score it: the **Scene Author's taste**, an **AI judge**, and the **Audience**. The AI judge speaks a short verdict out loud.

**Terminology (keep these distinct everywhere):**
- **Creators:** the up-to-5 players who each control one dial during a round.
- **Spectators:** everyone else in the room; they rate the result.
- **Scene Author:** the person who made a scene (for the demo, our team; later, any user).
- **Host:** the person running the session from the laptop.
- **Big screen:** `/screen`, fullscreen on the host's laptop display. There is no projector; Creators and Spectators use their phones.

---

## 3. Pitch and audience

**Core scenario (this is how we pitch and how the demo video will frame it):** you are in an office or a classroom meeting for the first time. The boss or teacher runs an icebreaker. Typical icebreakers are weird questions or games where people take turns talking, but nobody actually collaborates. Murmuration makes people collaborate for real: **nobody can finish the piece alone, because each person owns only one dial.** It also works for friends and teams who are bored and want a shared creative moment.

**Who it serves (for the submission text):** groups meeting in a shared physical space (new teams, classrooms, campus events, friend groups) who want a quick, skill-free way to work together.

**Design consequences of the icebreaker pitch:**
- **Optional nickname at join** (no account). Show who owns which dial on the big screen, and **credit each person at the reveal** ("Priya's Grid, Sam's Flicker, ..."). Nicknames appear on the shared screen, so filter them (blocklist plus length limit) and let the host rename or remove.
- **Role rotation across rounds.** With 30 people and 5 Creator slots, 25 would be watching, which contradicts the pitch. Each new round rotates previous Spectators into the Creator slots (queue order), so a short session gets everyone a turn.
- **Spectators still contribute** by rating each round (and, as a stretch, nudging a shared "energy" dial).

**Prior-art awareness (for internal consistency, not for the README):** crowd-driven generative art is an old genre in installation art; Gartic Phone/Drawception are sequential drawing chains; r/place and whiteboards give everyone the same direct control; Artbitrator-style AI judging is individual and competitive; QR-join with phone-as-controller is common (Jackbox-style). Our difference: **simultaneous, cooperative, one bounded role per person on one shared artwork.** Pitch line: *"Every game like this gives each player their own canvas. Ours gives each player one dial on the same canvas."*

---

## 4. Scenes: the core content system

A **scene is data**, not code. Every scene (our hand-made demo scenes now, user-made scenes later) loads through the same loader:

```
Scene {
  id, title, author
  baseArt        // fixed silhouettes/strokes drawn once (vector data, not images)
  hotspots[]     // optional tagged regions that motion choices can animate (demo scenes only)
  options        // per role: 4 options, each { id, label, renderParams, authorScore }
  prompts[]      // 8–10 task prompts written for this scene
}
```

### The three demo scenes (all Atlanta-specific, custom-made for the demo, P0)
1. **Atlanta rush hour:** gridlock on the Connector at 6 PM. Generic car and skyline silhouettes, brake-light glow. (A natural nod to mobility and automotive without using any brand.)
2. **Waffle House at 3 AM:** a generic roadside-diner sign ("OPEN 24 HRS" style), counter, window, mug. **No real logo.**
3. **Batman in Atlanta** a funny, memorable one: a caped figure on a rooftop over the Atlanta skyline with a searchlight in the clouds. **Use generic original imagery, not a trademarked character or logo** (the generic version keeps the joke and avoids IP filters, including Gemini's, if the name "Batman" does not work use "Midnight Vigilante(Superhero) instead).

Final scene names and jokes can be changed by the team; the structure is what matters.

### Two layers per scene
- **Layer A: base composition (fixed):** minimal silhouettes and line shapes. Keep it minimal so the room's choices do most of the visible work.
- **Layer B: live layer (controlled by Creators):** color wash (palette), an atmosphere/particle system acting as fog, steam, sparks, or dust around the fixed shapes (form), hotspot animation (motion), grain overlay (texture), and a faint mood-word watermark plus energy nudge (mood).

### Options: per scene, evocative, never neutral
Each scene defines its own 4 options per role, with labels that carry meaning for that scene (for example, the diner's palette might be *Fluorescent Sodium / Grease-Stained Gold / Midnight Neon / Muted Dust*; rush hour's might be *Brake-Light Red / Highway Sodium / Peach Sunset / Midnight Connector*). Roles: **palette, form, motion, texture, mood word.** One choice per role; richness comes from one decision governing hundreds of visual elements.

### How prompts work (important to get right)
There are two different things. **Options** are what Creators pick from. **Task prompts** are the challenge shown on screen ("Make the gridlock feel almost peaceful"). The **host chooses the scene**; the game then **randomly draws a task prompt from that scene's own list** (no repeats until the list is used up; an optional reroll button for the host). Prompts are drafted ahead of time (AI-assisted), hand-reviewed, and stored with the scene. **Never generated live.** Prompt formats should vary: single evocative word, tension pairs ("calm but urgent"), constraints ("joyful, without red"), sensory framing, and plenty of Atlanta humor. Every prompt must be expressible with that scene's option vocabulary.

### Photosensitivity
Any flicker option must stay below about 3 flashes per second with no hard full-screen strobing. Custom scenes cannot override this: they only choose from preset options.

---

## 5. Roles and joining

- **Creator slots: up to 5.** Priority if fewer join: palette, form, motion first; texture and mood word are bonus. A round must run cleanly with 3.
- **Host controls:** choose scene, start/reset round, reroll the prompt, manually assign a joining phone to a Creator slot, rename/remove a nickname, one-tap new round with rotation.
- **Waiting room is visible:** "Creators 3/5 joined. You're a Spectator, get ready to rate."
- **Soft undo only:** a Creator can change their own choice until the timer ends; the canvas cannot be rewound; at zero it locks irreversibly.
- **No participant accounts.** Anonymous auth only.

---

## 6. Rendering principles (non-negotiable)

1. **Decouple data arrival from visual smoothness.** Each live parameter has a *target* (latest network value) and a *current* (what is drawn); the local 60fps render loop eases current toward target. No jump cuts. Handle bursts.
2. **No generative-AI calls during the live round.** The live canvas is procedural code only.
3. **Deterministic and replayable:** seed the particle system and store the seed per round.
4. **Performance budget:** 60fps on the host laptop's display; cap devicePixelRatio; draw static base art once to an offscreen layer; adaptive particle count.
5. **Throttle phone writes** (about one per 100–150 ms while dragging); tiny JSON payloads.
6. **Designed for a group around a laptop:** big type on the laptop screen, readable at ~2 m; large one-handed touch targets and haptics on phones.

---

## 7. Round flow

1. Host picks a scene; QR and prompt appear; phones join (optional nickname); roles assigned; waiting room shows counts.
2. Prompt drawn from the scene's list. Timer starts (1–2 min) **from a server timestamp, not client clocks.**
3. Creators change choices; canvas evolves live; nicknames show who owns which dial.
4. Timer hits zero: **freeze, settle, lock, reveal** (light burst, title card). Capture a canvas snapshot.
5. After lock, in parallel: AI judge and voice generation start; Spectators get a **10–15 second** rating window.
6. Reveal the **three scores** and the judge's spoken verdict; credit each Creator's dial.
7. Optional Gemini "reimagined" version appears when ready; host can download a poster (see §10).
8. Log the round for replay; rotate roles; reset.

---

## 8. Scoring: three judges

- **Scene Author's Taste score (deterministic, no API):** the Scene Author scores every option they offer. A round's Author score is the **average of the author scores of the options the Creators actually chose** (roles with no Creator are skipped). It is hidden until the reveal. For authoring, **ranking beats sliders:** the author ranks the 4 options in each role (for example 10/7/4/1), which is faster and prevents everyone giving every option a 10. For the three demo scenes, our team authors these scores. This score ignores the prompt and the combination of choices; the AI judge covers coherence.
- **AI Match score (Gemini vision):** receives the task text, scene, each role's chosen option, and the canvas snapshot; returns a 1–10 match score and a one-line comment. Runs exactly once per round with a fallback.
- **Audience score:** Spectator ratings, **trimmed mean or median**, one vote per device.
- **Final score:** show all three separately, then a combined number (equal weights to start; adjustable constants). Pitch framing: *"three judges: the person who made the scene, an AI, and the room."* The canvas is what is judged, not the reimagined image.

---

## 9. Voice: the AI judge speaks (ElevenLabs)

- Gemini writes a **40–60 word script** (about 15–25 seconds) from structured facts: scene, prompt, each role's chosen option by name, scores, and the image. Output is the script only (JSON, no preamble).
- Must reference **at least two actual choices**, include one joke and one genuine observation. **Roast the art, never individuals.**
- Generate during the Spectator voting window so it is ready when scores appear.
- **Fallbacks:** pre-written verdicts with pre-generated audio; cache audio by script hash; mute toggle; per-session call caps.
- **Walkthrough narration for demo mode** is generated once and shipped as **static audio files** (no live API use).

---

## 10. Reimagined render and poster (changed at the event: D-36, D-37)

Adobe sponsors the Creative track but runs no Adobe product challenge, and could not issue Firefly credentials, so the original Firefly and Express plan is dropped.

1. **Gemini "Reimagined" render (P1).** After the reveal, asynchronously, send the locked canvas snapshot to Gemini's image model with a prompt built from the round (scene, palette name, mood word) that tells it to keep the composition. Show side by side with the original canvas, which remains the judged artwork. **Backend-only key.** Fail gracefully: if slow or failing, skip it. Never generate during the round. Use generic wording in prompts (no trademarked character names). Test early with a real snapshot to tune the prompt.
2. **Poster (P2).** A p5-rendered PNG (title, prompt, three scores, credits) downloaded from `/host`.

---

## 11. Scene Studio (last priority: P3)

Goal: let any user make a scene without logging in, and play it. This is the "platform" part of the pitch and our most ambitious feature, so it is **strictly last** and must be a **lite** version.

**Lite scope:**
- **Draw-only. No image uploads.** Freehand brush (a few thicknesses), basic shapes (circle, rectangle, triangle, line), eraser, undo, clear. Monochrome silhouettes plus a couple of accent tones. Stored as **vector strokes** (small payloads), not images.
- Title (short text).
- **Pick options from a shared preset library, not custom render params:** for each role the author chooses 4 options from the library (palettes, forms, motions, textures, mood words that already have render parameters), then **ranks them** to create Author scores.
- **Prompts:** author writes 1–3, or taps "Suggest prompts" and Gemini drafts them at creation time, constrained to the chosen options, for the author to edit and accept.
- **No hotspots** for custom scenes; generic effects only (the three demo scenes are the polished, hand-tuned ones, and we say so plainly).
- **Create → moderation → publish.**

**Moderation (must be in the same flow, fail closed):**
- On Create, send the **canvas screenshot and every text field** (title, prompts, mood words) in one Gemini call that returns structured JSON `{approved, category, reason}`. If not approved, show **"Content not suitable"** and do not publish. If the call errors or times out, **do not publish** (fail closed).
- New scenes are private to the author until approved. Add a **Report** button and a host/admin remove control.
- Rate-limit creation per anonymous user and cap scenes per device.
- Filter nicknames too.

**Scene Gallery:** a simple browsable list of approved scenes (the three demo scenes pinned first) with a play counter; the host picks a scene from it. "Most played" is enough; a full trending section is roadmap.

---

## 12. Demo mode and dev harness

- **Demo mode:** simulated Creators and Spectators fill the roles so one person with one phone can run a complete round without a crowd, with the static narration guiding them.
- **Dev harness (`/dev`):** manual sliders for every parameter plus a "simulate crowd" bot that fakes bursts. Used to tune look and smoothing without five phones; may double as demo mode.

---

## 13. Replay and sharing (Tiger Data, off the critical path)

Log each Creator choice as an event (round, role, choice, timestamp) in Tiger Data. Share a **link, not a video file**: a replay page re-runs the event log through the same renderer with the stored seed, with an OG preview image so it unfurls in Discord, Slack, WhatsApp, and iMessage. Never on the live path.

---

## 14. Technology (preferred; flag tradeoffs if you disagree)

- **Realtime sync:** Firebase (Realtime Database or Firestore) with listeners; anonymous auth plus **strict security rules** (public repo; one phone must not write another's role; one vote per device; scene creation rate-limited).
- **Canvas:** p5.js (2D live; WEBGL or a small shader only for the reveal).
- **Phone page:** minimal vanilla JS or a very light framework.
- **Backend:** Node (Express) or Firebase Cloud Functions for session logic and all external API calls. **All API keys server-side.**
- **AI:** Gemini (script, judge, reimagined render, moderation, prompt suggestions), ElevenLabs (voice).
- **Data:** Tiger Data for the event log (async); Firebase for scenes and live state.
- **Hosting:** Vercel or Netlify for frontends; Firebase for realtime.
- **Domain:** a short GoDaddy domain used as the QR destination (for now I was thinking about the name myBossDoesLameIcebreakers).
- **Not using:** Auth0 for participants, Solana. Do not twist the product to chase unannounced challenges.

---

## 15. Reliability requirements (high priority)

Works on congested venue WiFi with many phones; tiny payloads; managed realtime infra; graceful degradation (looks intentional with 3 Creators); reconnect handling (host refresh mid-round must not corrupt the round); race conditions (two phones claiming a role, near-simultaneous changes, join storms); cost and quota protections and kill-switches on every external API; always-deployable `main` with a known-good tagged build; test on the demo laptop at its real display scaling; keep a recorded full run as backup.

---

## 16. Priorities

**P0: a complete, demoable product with no AI.** QR join with optional nickname; roles; the data-driven scene loader; **the three Atlanta demo scenes** (base art, option menus with Author scores, prompt lists); live-syncing canvas with target/current smoothing; server-timed round; lock and reveal; host controls; demo mode and dev harness; security rules.

**P1: the "wow" and the scoring.** Gemini AI judge; Spectator rating with trimmed mean; Author's Taste score and the three-score reveal; ElevenLabs verdict with fallbacks; role rotation across rounds and credits at the reveal; reveal polish and sound; Gemini Reimagined render.

**P2: stretch once P0 and P1 are solid.** p5 poster; Tiger Data replay link; static narration audio; GoDaddy domain; Spectator "energy" dial.

**P3: last priority.** Scene Studio (lite) with moderation and the Scene Gallery. It must be real, working, and moderated, or not shown.

**Roadmap only (pitch, do not build):** trending section, accounts, tournaments between teams, education modules, enterprise/event licensing.

---

## 17. Non-goals

No participant accounts; no native mobile app; no image uploads for scenes; no whole-canvas undo; no live AI calls inside the timed round; no per-person drawing during rounds; no majority-vote-only core loop; no real brand logos or trademarked characters; no building around unannounced sponsors.

---

## 18. Instructions to the agent

1. **Do not write implementation code.**
2. Read this brief. **Ask me every clarifying question you need, grouped by topic, before planning.** Flag anything ambiguous or contradictory.
3. After I answer, produce these files in `/docs`: `ARCHITECTURE.md`, `DATA_SCHEMA.md` (session, round, scene, option, role/choice, nickname, spectator rating, scores, event log, gallery entry), `ROUND_STATE_MACHINE.md`, `CONTRACTS.md` (event types, payload limits, score formulas, shared constants), `RISKS.md`, `BUILD_ORDER.md` (P0 through P3 with hour estimates for a 36-hour build and a clear cut line).
4. For every external API (Firebase, p5.js, Gemini, Firefly, ElevenLabs, Tiger Data, Adobe Express Embed SDK), ground recommendations in the indexed docs; do not invent method names.
5. Maintain `docs/DECISIONS.md` recording every settled decision.
6. Include a failure matrix (WiFi drops, Gemini timeout or moderation error, ElevenLabs or Firefly failure, quota hit, host refresh mid-round, a Creator disconnecting mid-round, nobody joins, abusive nickname or scene) with a fallback for each.