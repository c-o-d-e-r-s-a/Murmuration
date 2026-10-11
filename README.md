# Murmuration

**Three people. Three dials. One artwork.**

A live, in-person cooperative art game. Phones scan a QR — no app, no account. Up to three **Creators** each own one dial (*palette*, *form*, or *motion*) of a single shared piece on the big screen. Everyone else is a **Spectator** and rates what the room made. Nobody can finish the piece alone.

> *Every game like this gives each player their own canvas. Ours gives each player one dial on the same canvas.*

Built at **Hacklanta** (Atlanta, Creative track) as a skill-free icebreaker for rooms that are tired of weird questions and turn-taking.

---

## Try it

| | |
|---|---|
| **Live** | [mybossdoeslameicebreakers.work](https://mybossdoeslameicebreakers.work) |
| **Demo (solo, ~60s)** | [/demo](https://mybossdoeslameicebreakers.work/demo/) — no phones, no room |
| **Host a session** | [/host](https://mybossdoeslameicebreakers.work/host/) — QR, timer, big screen |

Fallback host URL: [murmuration-33d60.web.app](https://murmuration-33d60.web.app)

---

## How a round works

```text
Lobby  →  Live (1–2 min)  →  Lock  →  Settle  →  Rate  →  Reveal
              ↑
     Creators change dials;
     canvas eases toward their choices
```

1. **Host** picks a scene. A QR and task prompt appear on the laptop.
2. Phones join with an optional nickname. First three become Creators; the rest are Spectators.
3. Timer runs on **server time**. Creators tap options; the shared canvas updates smoothly (no jump cuts).
4. At zero the piece **locks**. Spectators rate 1–5. Three judges score the locked frame.
5. Scores + a spoken AI verdict. Roles rotate so a short session gets everyone a turn.

### Three judges

| Judge | What it scores |
|---|---|
| **Scene Author** | Deterministic taste from pre-ranked options (no API) |
| **AI (Gemini)** | Vision match to the prompt — runs **after** lock only |
| **Audience** | Spectator ratings (trimmed mean / median, one vote per device) |

The live canvas is procedural (p5.js). Generative AI never runs during the round.

---

## Scenes

Hand-authored Atlanta scenes — data, not code. Generic original art only (no brand logos or trademarked characters).

| Scene | Vibe |
|---|---|
| **Atlanta rush hour** | Gridlock, brake-light glow, skyline |
| **Roadside diner at 3 AM** | Counter, mug, “OPEN 24 HRS” neon energy |
| **Midnight vigilante** | Caped figure, searchlight, city rooftops |

Each role has four evocative options written for that scene. One choice drives hundreds of visual elements.

---

## Stack

| Layer | Tech |
|---|---|
| Client | Vite multi-page TypeScript, p5.js 1.x |
| Sync | Firebase Realtime Database + Anonymous Auth |
| Backend | Cloud Functions (2nd gen), Cloud Storage, Hosting |
| After lock | Gemini (judge + script + reimagined image), ElevenLabs (spoken verdict) |
| Analytics / replay | Tiger Data (Timescale) event mirror |
| Shared contracts | `shared/` imported by web and functions |

---

## Repo layout

```text
web/
  screen/   Big-screen canvas (host laptop)
  play/     Phone join + dials + ratings
  host/     Session console, QR, controls
  demo/     Solo offline walkthrough
  replay/   Shareable replay from event log
  dev/      Renderer harness / crowd sim
  lib/      Firebase client, renderer
shared/     Contracts, scoring, scenes, presets
functions/  Judge, TTS, reimagine, Tiger mirror
docs/       Brief, decisions, architecture, schema
```

---

## Local development

**Requires Node 24.**

```bash
npm install
npm run dev
```

Vite serves the multi-page app from `web/`:

| Path | Page |
|---|---|
| `/` | Landing |
| `/host/` | Host console |
| `/screen/` | Big screen |
| `/play/` | Phone client |
| `/demo/` | Solo demo |
| `/dev/` | Renderer harness |

```bash
npm run typecheck   # web + functions
npm run lint
npm run test        # scoring self-checks
npm run build       # → dist/ for Firebase Hosting
```

### Full stack (emulators + secrets)

The checked-in web config points at the live Firebase project. For local Functions / rules work:

1. Install the CLI: `npm i -g firebase-tools` then `firebase login`
2. Copy `.env.example` → secrets for emulators (see [docs/SETUP.md](docs/SETUP.md)); never commit `.env*`
3. `firebase emulators:start` (Auth, RTDB, Functions, Storage, Hosting)
4. Keep `npm run dev` for the Vite pages

Server keys (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `TIGER_DATABASE_URL`) live only in Cloud Functions secrets — never in `web/` or `shared/`.

---

## Design constraints (worth knowing)

- **Smooth sync:** every live param has a *target* (network) and a *current* (drawn); the 60fps loop eases between them.
- **Tiny payloads:** a choice is `{ optionId, uid, at }` — no images or streams in RTDB.
- **Host owns round state;** phones write only nick, choice, and rating. Timer uses server time.
- **Deterministic render:** seeded from `round.seed`. Photosensitivity cap ≤ 3 Hz flicker.

---

## Documentation

| Doc | What it is |
|---|---|
| [docs/00-brief.md](docs/00-brief.md) | What & why (source of truth) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Settled product/tech decisions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System shape |
| [docs/ROUND_STATE_MACHINE.md](docs/ROUND_STATE_MACHINE.md) | Lobby → reveal |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Shared constants & shapes |
| [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) | RTDB paths & rules intent |
| [docs/SETUP.md](docs/SETUP.md) | Accounts, keys, domain |
| [AGENTS.md](AGENTS.md) | Guidance for coding agents |

---

## Pitch in one line

Groups meeting in a shared space who want a quick, skill-free way to collaborate for real — because **each person owns only one dial of the same canvas**.
