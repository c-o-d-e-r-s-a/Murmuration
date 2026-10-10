# Murmuration

A live, in-person cooperative art game: scan a QR, each Creator owns one dial of one shared artwork, and three judges (the Scene Author, an AI, the room) score the result.

*Every game like this gives each player their own canvas. Ours gives each player one dial on the same canvas.*

## Docs
Start with [docs/00-brief.md](docs/00-brief.md), then [DECISIONS](docs/DECISIONS.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [ROUND_STATE_MACHINE](docs/ROUND_STATE_MACHINE.md), [BUILD_ORDER](docs/BUILD_ORDER.md). Agent guidance: [AGENTS.md](AGENTS.md).

## Stack
Vite + TypeScript, p5.js, Firebase (RTDB, Auth, Hosting, Functions, Storage), Gemini, ElevenLabs, Tiger Data.

## Setup
Application code is not scaffolded yet (see BUILD_ORDER Phase 0). Copy `.env.example` to `.env` for local keys; never commit it.

## Commands
Cursor commands in `.cursor/commands`: `/verify`, `/review-diff`, `/handoff`.
