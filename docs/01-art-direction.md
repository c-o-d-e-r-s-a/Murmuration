# 01 — Art Direction: Murmuration

> How it should look, move, and sound. Companion to [00-brief.md](00-brief.md) §6 (rendering principles) and [DECISIONS](DECISIONS.md). Constants that already exist in [CONTRACTS](CONTRACTS.md) (`EASE_NUMERIC_MS`, `EASE_PALETTE_MS`, `FLICKER_MAX_HZ`, `SETTLE_MS`, rating window) are referenced, not redefined. If this file and CONTRACTS disagree, CONTRACTS wins and this file gets fixed.

Scope: UI chrome on `/screen`, `/play`, `/host`, `/replay`; the lock-and-reveal; sound cues. The artwork itself is governed by scene palettes in the preset library (D-17); §9 gives the taste rules for those.

---

## 1. Direction in one paragraph

**A dark gallery wall with one warm lamp.** The chrome is near-black and recedes; the shared artwork is the only large bright thing in the room. One warm "sodium" accent (the color of Atlanta streetlights) carries every action and the timer. Type is big, wide, and warm off-white. Motion is slow and eased during the round, hushes at lock, then turns game-show for exactly four beats (three scores and a combined number) before settling back. Sound is sparse analog synth plus one physical "thunk". The name is carried by a flock of small dots, reusing the particle system we already have.

Settled taste choices (owner, this session): dark gallery chrome · one sodium accent + three muted role hues (badges only: palette, form, motion) · Bricolage Grotesque + Instrument Sans · cinematic lock, punchy scores · minimal analog SFX · flat 12/16 px surfaces with hairlines · flock-of-dots motif · huge faint mood-word watermark.

---

## 2. Color tokens

Tokens are for **UI chrome only**. The canvas uses the scene's palette preset (`RenderParams.colors`), never these.

### 2.1 Laptop display: what changes (D-38)

- **Glare and off-axis viewing lift blacks.** The group stands around the laptop, not square in front of it; on glossy or budget IPS panels `#0B0B0F` reads around `#2A2A33` off-axis or under room lights, and the bottom ~10% of tones collapse into one gray. So: never carry meaning in a dark-on-dark difference, every surface gets a hairline border, and body text must clear **7:1 on true black** so it still clears **≥ 4.5:1 on lifted black**.
- **Small, scaled viewport.** A 1080p panel at 125% or 150% Windows scaling gives a 1536×864 or 1280×720 CSS viewport; 16:10 panels add height. Design at 1920×1080 and scale with `vw`/`vh` (§3.1, §4); the canvas letterboxes on 16:10 with `ink-0` bars.
- **Budget panels are 6-bit and band** on dark gradients; grain stays on (§9).
- **Glare at night.** Primary text is warm off-white `#F4EFE6`, not `#FFFFFF`. Host setup: brightness max, Night light / True Tone off, plugged in (battery saver throttles the GPU).

### 2.2 Palette

Contrast ratios are WCAG 2.x, computed. Columns: on `ink-0` (true black chrome) / on `surface-2` (cards) / on **lifted** `#2A2A33` (glare / off-axis simulation).

| Token | Hex | Use | ink-0 | surface-2 | lifted |
|---|---|---|---|---|---|
| `--ink-0` | `#0B0B0F` | Page background, screen chrome | — | — | — |
| `--surface-1` | `#15151C` | Bars, strips | — | — | — |
| `--surface-2` | `#1F1F29` | Cards, phone buttons at rest | — | — | — |
| `--hairline` | `#3A3A48` | 1 px borders on every surface | 1.76 | — | 1.27 |
| `--text-primary` | `#F4EFE6` | Headlines, numerals, button labels | **17.15** | 14.26 | **12.41** |
| `--text-secondary` | `#B8B2A7` | Body, captions, nick list | **9.32** | 7.75 | **6.74** |
| `--text-muted` | `#9A948A` | Hints, timestamps, "from 23 ratings" | 6.53 | 5.42 | 4.72 |
| `--accent` (sodium) | `#FFB45A` | Timer, primary action, selected option, focus ring | **11.16** | 9.27 | **8.07** |
| `--accent-ink` | `#1A1206` | Text on accent fills | 10.53 on accent | | |
| `--urgent` (brake) | `#FF6B5E` | Countdown last 10 s only | 7.03 | 5.84 | 5.09 |
| `--ok` | `#6FD39B` | Connected dot, "Thanks" check | 10.73 | 8.91 | 7.76 |

Role hues. **Only** in dial badges (dot + pill), credits strip, and the Creator's "You made this" card. Never on buttons, never as text color for sentences.

| Token | Hex | Role | ink-0 | lifted | `ink-0` text on fill |
|---|---|---|---|---|---|
| `--role-palette` | `#E88A6A` | Palette (terracotta) | 7.74 | 5.60 | 7.74 |
| `--role-form` | `#7FB3D5` | Form (fog blue) | 8.71 | 6.30 | 8.71 |
| `--role-motion` | `#B48EEB` | Motion (violet) | 7.49 | 5.42 | 7.49 |
| `--role-texture` | `#9CB58A` | Texture (sage) | 8.78 | 6.36 | 8.78 |
| `--role-mood` | `#D98CB3` | Mood (rose) | 7.81 | 5.65 | 7.81 |

Rules:
- Minimums: big-screen text ≥ 7:1 on its surface (all of `text-primary`, `text-secondary`, `accent` pass on lifted black; `text-muted` is phone/host only and never under 28 px on screen). Phone text ≥ 4.5:1 (everything passes).
- Surface steps (`ink-0` → `surface-1` → `surface-2`) are 1.08–1.11:1 and **will vanish under glare or off-axis**. They are tonal nicety only; the hairline does the work.
- One accent. If you reach for a second accent, use `text-primary` weight or size instead.
- Scrim for text over artwork: `rgba(11,11,15,0.72)` solid panel, or a vertical gradient from `rgba(11,11,15,0)` to `rgba(11,11,15,0.85)` over the bottom 28% of the canvas. These are the only two gradients allowed in the chrome.

---

## 3. Typography

Two families, both Google Fonts, both variable, both **self-hosted** (download the latin woff2 files into `web/public/fonts/`; venue WiFi may throttle or block `fonts.googleapis.com`). Preload both; `font-display: swap`; latin subset only.

- **Display: Bricolage Grotesque** (axes: `opsz 12–96`, `wdth 75–100`, `wght 200–800`). Used for countdown, prompt, title card, scores, wordmark, phone role title, option labels. Default `wght 700`, `wdth 100`, let `opsz` auto. Tight tracking at display sizes: `letter-spacing: -0.02em` above 96 px, `-0.01em` 40–96 px, `0` below.
- **Text: Instrument Sans** (`wght 400–700`). Everything else: body, captions, nick list, host UI (verdict script on `/host` only, D-43). `wght 500` default, `600` for emphasis. Line height 1.3 on screen, 1.4 on phone.
- Numerals: `font-variant-numeric: tabular-nums` on countdown, scores, counts, so digits do not jitter while counting.
- Fallback stacks: display `"Bricolage Grotesque", "Arial Black", system-ui, sans-serif`; text `"Instrument Sans", system-ui, sans-serif`. A screenshot showing the fallback is a QA fail (§11, item 3).
- Case: sentence case everywhere. Small caps (`text-transform: uppercase; letter-spacing: 0.12em; wght 600`) only for tiny labels: role names on badges, "Author · AI · Audience" captions, the "Reimagined with Gemini" tag (D-43).

### 3.1 Type scale: big screen (`/screen`, `/replay`)

Reference 1920×1080. Sizes in px at 1080p and the `clamp()` that keeps them proportional on laptop viewports from 1280×720 to 1920×1080 CSS px. Nothing on the big screen is smaller than **24 px at 1080p** (≈ 1.25 vw).

| Token | 1080p | CSS | Family / weight | Where |
|---|---|---|---|---|
| `--fs-screen-hero` | 200 | `clamp(120px, 10.4vw, 280px)` | Display 800 | Combined score at reveal |
| `--fs-screen-count` | 160 | `clamp(96px, 8.3vw, 224px)` | Display 700, tabular | Countdown |
| `--fs-screen-title` | 120 | `clamp(72px, 6.25vw, 168px)` | Display 700 | Title card prompt, wordmark |
| `--fs-screen-score` | 112 | `clamp(64px, 5.8vw, 156px)` | Display 700, tabular | Three score numerals |
| `--fs-screen-prompt` | 72 | `clamp(44px, 3.75vw, 100px)` | Display 600 | Prompt during live |
| `--fs-screen-h2` | 48 | `clamp(30px, 2.5vw, 68px)` | Display 600 | Scene title, "The room is judging" |
| `--fs-screen-body` | 36 | `clamp(24px, 1.875vw, 50px)` | Text 500 | AI comment, nick list, host verdict script |
| `--fs-screen-label` | 28 | `clamp(24px, 1.46vw, 40px)` | Text 600 small caps | Badges, captions, "from 23 ratings" |

Line lengths: prompt ≤ 2 lines at 72 px (scene prompts must be ≤ ~60 characters; add-scene skill should enforce). Host verdict script ≤ 3 lines at 36 px when shown (D-43: not on `/screen`).

### 3.2 Type scale: phone (`/play`) and host (`/host`)

Reference 390 px wide. Minimum **14 px**. Host page uses the same scale; it is a tool, not a show.

| Token | px | Family / weight | Where |
|---|---|---|---|
| `--fs-phone-count` | 48 | Display 700, tabular | Countdown |
| `--fs-phone-title` | 32 | Display 700 | "You are the Palette", "You made this", scores |
| `--fs-phone-option` | 22 | Display 600 | The four option labels, rating numerals (28) |
| `--fs-phone-body` | 17 | Text 500 | Instructions, prompt text |
| `--fs-phone-caption` | 14 | Text 600 small caps | Role badge, status line, "Reconnecting" |

---

## 4. Spacing, layout, shape

- **Grid:** 4 px base; allowed steps `4 8 12 16 24 32 48 64 96`. Screen uses the upper half (24+), phone the lower half (8–32).
- **Safe area (screen):** 5% on every edge (96 px left/right, 54 px top/bottom at 1080p). Nothing textual crosses it. The canvas itself fills the full viewport; only chrome respects the safe area. All `/screen` px values in this file are at 1080p; implement them in `vw`/`vh` so a 1280×720 laptop viewport keeps the same composition.
- **Screen layout, live:** canvas full-bleed. Top bar `surface-1` at 72% opacity, 112 px tall: prompt left (max 60% width), countdown right. Bottom strip 96 px: up to three dial badges, left-aligned, 24 px gaps; Spectator count far right. That is the whole live UI.
- **Screen layout, lobby:** left card 40% width: QR (≥ 52vh, i.e. 560 px at 1080p; white quiet zone 32 px, `ink-0` modules on `#F4EFE6`), session code below it at `--fs-screen-h2`, URL at `--fs-screen-body`. Right 60%: wordmark, scene title, "Creators 3/3 joined", nick list, flock drifting behind at low opacity.
- **Phone layout:** single column, 20 px side padding, content top-aligned; the **primary interaction sits in the bottom 60%** of the viewport (thumb zone). Header: role badge + countdown. Creator: four option buttons stacked, 72 px tall, 12 px gap, full width. Spectator rating: five buttons in one row, each ≥ 64×64, 8 px gap. Minimum touch target anywhere: **56 px**. `navigator.vibrate(30)` on every accepted tap.
- **Radius:** cards 12 px, phone buttons 16 px, badges pill. Nothing else.
- **Surfaces:** flat fill + 1 px `--hairline`. No drop shadows, no blur, no inner glow. Elevation is expressed by `surface-1` vs `surface-2` plus the border, not by shadow.
- **Selected state (phone option):** fill `--accent`, text `--accent-ink`, 2 px inset ring `--text-primary` at 40%. Unselected: `surface-2` + hairline. Disabled (locked): opacity 0.5, no ring.
- **Focus (host, keyboard):** 3 px `--accent` outline, 2 px offset.
- **Icons:** none in P0 except the connected dot and a single lock glyph. If an icon is needed, use a 2 px stroke outline icon set, 32 px on screen, 24 px on phone; never emoji.

---

## 5. Motion principles

The renderer's smoothing (brief §6, CONTRACTS `EASE_NUMERIC_MS = 600`, `EASE_PALETTE_MS = 900`) is exponential: `current += (target - current) * (1 - exp(-dt / tau))`. Chrome motion must feel like it belongs to the same world: **slow during the round, one hush, four punches at reveal, then slow again.**

### 5.1 Durations

| Token | ms | Use |
|---|---|---|
| `--dur-micro` | 120 | Button press, badge highlight, haptic-paired feedback |
| `--dur-standard` | 240 | Fades, list item enter/exit on phone |
| `--dur-emphasized` | 480 | Title card slide, panel reflow, lobby to live chrome swap |
| `--dur-cinematic` | 900 | Light bloom, Reimagined crossfade, screen fade to lobby |
| `--dur-settle` | 1500 | `SETTLE_MS` from ROUND_STATE_MACHINE; particle time-dilation to 0 |

### 5.2 Easings

| Token | Curve | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default; everything entering or moving |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Anything leaving |
| `--ease-stamp` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Score stamps and the combined slam **only** (overshoot ≈ 12%) |
| `linear` | — | Countdown ring, rating-window rail, count-up numerals' time base |

### 5.3 Rules

1. Animate `transform` and `opacity` only. Never animate `width`, `height`, `top`, `left`, `filter`, `backdrop-filter`.
2. Nothing in the chrome oscillates faster than **1 Hz**; the renderer is capped at `FLICKER_MAX_HZ = 3` and `FLICKER_MAX_AREA = 0.25`, enforced in presets, not here.
3. One overshoot family (`--ease-stamp`), used at most 4 times per round, all within the reveal.
4. Staggers are 120 ms per item, max 5 items (dial badges, credits).
5. No "catch-up" animation after a refresh: a refreshed `/screen` starts with `current = target` (ROUND_STATE_MACHINE §5).
6. `prefers-reduced-motion` on phones: replace slides with 240 ms crossfades; keep haptics. The big screen ignores it (it is a show), but the bloom stays a single soft event.
7. Count-ups run 600 ms, `--ease-standard` on the value, integer display only until the last 100 ms, then one decimal.
8. Idle states breathe, they do not spin: the "judging" indicator is three dots at 0.5 Hz opacity breathing. No spinners on the big screen, ever.

---

## 6. Lock-and-reveal choreography

Times are relative to `lockedAt` (T3) until the rating window, then relative to `status = reveal` (T5). Constants from ROUND_STATE_MACHINE: settle 1500 ms, rating 12 000–25 000 ms. The renderer keeps drawing throughout; the chrome layers on top.

### 6.0 Pre-lock: last 10 seconds (`live`, `endsAt - 10 000`)
- Countdown color eases `--accent` → `--urgent` over 600 ms. Ring around the numeral pulses at 1 Hz (scale 1.00 → 1.04, opacity 1 → 0.7).
- **Sound:** `tick` on each second boundary, soft, −18 dB relative to master.
- Phones: countdown mirrors the same color change; option buttons stay live until the server-timed zero.

### Beat 1 — Shutter (0 to 200 ms)
- Countdown hard-stops on `0:00` (no ease), holds 200 ms, then fades with the rest of the chrome: prompt bar, dial strip, and countdown all fade to 0 over 300 ms `--ease-exit`. The canvas is now the whole screen.
- Renderer: `target` is frozen (no more `choices` writes are accepted by rules). `current` keeps easing toward `target` so it arrives during settle.
- **Sound:** `lock` — one low physical thunk + short room tail, 500 ms.
- Phones: `vibrate(60)`; Creator buttons dim to disabled; headline "Locked" in `--fs-phone-title`; Spectators see "Locked, get ready to rate."

### Beat 2 — Settle (200 to 1500 ms)
- Particle time-dilation: particle speed and hotspot motion amplitude ease to 0 over the remaining settle time (`--ease-standard`). Grain holds. Vignette deepens by +0.10 over the same window.
- Nothing else moves. Silence after the lock tail. This is the hush.

### Beat 3 — Snapshot and bloom (1500 ms, `SETTLED`)
- `/screen` renders the final frame with `current = target` and captures the 1280×720 JPEG (T4a). **The bloom starts on the frame after capture**, so the judged image never contains UI.
- Bloom: a radial gradient from canvas center, `--accent` at 35% mixed with `--text-primary`, opacity 0 → 0.55 → 0 over 900 ms (`--ease-standard` in, `--ease-exit` out), radius 0 → 1.4× canvas diagonal. One event, not a strobe; photosensitivity-safe by construction.
- Flock: ~60 motif dots (seeded from `round.seed`) burst outward from center with the bloom front and fade over 900 ms.
- **Sound:** `bloom` — rising pad swell, 1200 ms, lands softly.

### Beat 4 — Title card (1800 to 2400 ms)
- Bottom scrim (gradient, §2.2) fades in 480 ms. Title card slides up 48 px into the bottom third, `--dur-emphasized`, `--ease-standard`: scene title in small caps `--fs-screen-label`, prompt text in Display `--fs-screen-title` (max 2 lines), hairline above.
- Top-right: small caption "The room is judging" `--fs-screen-h2` with three breathing dots (0.5 Hz).

### Beat 5 — Rating window (`rating`, 12 to 25 s)
- Screen: artwork + title card hold. A 4 px rail along the very bottom edge drains linearly from full to empty over `ratingEndsAt - now`; when the host extends the window (3 s steps) the rail eases its length over 240 ms rather than jumping.
- Spectator phones: five rating buttons stamp in with a 120 ms stagger (`--ease-stamp`, 320 ms). Tap: `vibrate(30)`, selected button fills `--accent`, others fade to 0.4, headline becomes "Thanks" with an `--ok` check 240 ms later. Write-once, so the buttons then disable.
- Creator phones: "You made this" card: their role badge in its role hue, their chosen option label in Display 32, "Scores on the big screen" caption. No rating buttons.
- **Sound:** none. The room is the sound.

### Beat 6 — Three scores (`reveal` + 0 to 1400 ms)
- Title card compresses: slides to the top safe area and shrinks the prompt to `--fs-screen-h2` over 480 ms. The artwork scales to 0.78 toward the left-center; the right 40% becomes the scoreboard column (`surface-1` 72% opacity, hairline).
- Three score cards stamp in **top to bottom**, 400 ms apart: Author's Taste, AI Match, Audience. Each card: scale 1.15 → 1.00 over 320 ms `--ease-stamp`; label in small caps; numeral counts up 0 → score over 600 ms (`--fs-screen-score`, tabular). AI card adds the one-line comment in `--fs-screen-body` 200 ms after its numeral lands; the "(offline judge)" tag appears if `fallback`. Audience card adds "from N ratings" in `--text-secondary` (`--text-muted` is phone/host only).
- Null scores (no audience, no AI): the card still stamps in, shows an em dash, caption "no ratings" / "judge offline". Never an empty slot.
- **Sound:** `stamp-1`, `stamp-2`, `stamp-3` — same pluck, rising pitch (root, major third, fifth), 350 ms each, synced to each card's landing frame.

### Beat 7 — Combined (`reveal` + 1600 ms)
- The combined number slams in below the three cards: `--fs-screen-hero`, scale 1.30 → 1.00 over 260 ms `--ease-stamp`, with a second, smaller bloom behind it (opacity 0 → 0.3 → 0, 600 ms). Caption "Combined" small caps.
- **Sound:** `slam` — low thunk doubled with a held pad chord, 900 ms.

### Beat 8 — Verdict (`reveal` + 2200 ms)
- `results.verdict.audioUrl` plays (requires the one-click audio unlock at session start; host has a manual Play per RISKS R14). Master SFX bus ducks −12 dB while the voice plays.
- No transcript on `/screen` (D-43): voice only, plus the manual Play control when autoplay is blocked. The script stays in RTDB for `/host` diagnostics.
- If `fallback: true`: same visuals; the canned clip plays. Never show a loading state here.

### Beat 9 — Credits (when verdict ends, or `reveal` + 25 s, whichever first)
- Bottom strip returns (`surface-1`, 96 px): up to three dial badges slide in from the left, 120 ms stagger: role dot in role hue, "Priya · Palette · Peach Sunset" in `--fs-screen-label`. Unfilled roles are **omitted**, not shown as empty; three Creators yield three badges, evenly spaced, and it looks deliberate.
- Phones: scores (three + combined) in a stacked list, "Next round soon" caption.

### Beat 10 — Reimagined (async, only if ready)
- When `results.reimagined.url` arrives: the artwork slides left to occupy 50%, the reimagined image crossfades in on the right over `--dur-cinematic`, with a small-caps "Reimagined with Gemini" tag (D-43). If it never arrives, nothing changes; no placeholder, no spinner. The host sees the status on `/host`.
- **Sound:** none.

### New round (T6)
- Everything fades to `ink-0` over `--dur-cinematic`; lobby returns with QR and the flock drifting. 

---

## 7. Sound cues

Static files in `web/public/sfx/`, OGG + MP3, each ≤ 60 KB, mono, 44.1 kHz, peak −3 dBFS, trimmed with ≤ 10 ms fade in/out. Produced offline once (any synth; tuned by ear on the laptop speaker, then checked on a Bluetooth speaker). Played through one pre-created `AudioContext` unlocked by the host's "Start session" click (RISKS R14). Mute toggle on `/host` silences SFX and voice together.

Character: soft analog synth (filtered saw pads, sine plucks, one kick-like thunk with a short plate tail). No chiptune, no sampled applause, no whooshes.

| Cue | File | Trigger | Length | Gain vs master | Notes |
|---|---|---|---|---|---|
| `tick` | `tick.ogg` | Each second in the last 10 s of `live` | 80 ms | −18 dB | Dry sine click, slight pitch rise on the last 3 |
| `lock` | `lock.ogg` | `status` → `locked` | 500 ms | −6 dB | Low thunk ~80 Hz + short plate tail; the one "physical" sound |
| `bloom` | `bloom.ogg` | Settle end (frame after snapshot) | 1200 ms | −10 dB | Filtered pad swell, lands on a soft major chord |
| `stamp-1/2/3` | `stamp-{n}.ogg` | Each score card lands | 350 ms | −9 dB | Same pluck at root / major third / fifth |
| `slam` | `slam.ogg` | Combined number lands | 900 ms | −6 dB | Thunk doubled with a held pad chord |
| `verdict` | from Storage (D-25) | Beat 8 | 15–25 s | 0 dB | Voice; SFX bus ducks −12 dB while playing |

Deliberately **no** cue for: phone join, choice change, Spectator rating, Reimagined arrival, new round. Thirty phones joining should be visible, not audible.

Phones make no sound. They use `navigator.vibrate`: 30 ms on accepted tap, 60 ms at lock, `[40, 60, 40]` when the phone's own role card appears.

---

## 8. Brand motif and wordmark

- **Wordmark:** "Murmuration" set in Bricolage Grotesque 800, `wdth 90`, `letter-spacing -0.03em`, `--text-primary`. No logo glyph.
- **Flock:** 40–80 motif dots (2–4 px at 1080p, `--text-primary` at 20–35% opacity) that drift with the same seeded noise field the particle system uses. Appears in: lobby background (slow drift behind the right column), reveal bloom (burst outward, Beat 3), `/replay` idle, the p5 poster fallback (D-27) as a faint corner flourish. It must never appear over the live artwork during `live`.
- The QR card is the one place pure `#F4EFE6` fills a large area; the QR needs it.

---

## 9. Taste rules for the artwork layer (for scene authors and presets)

These are design guidance for `shared/presets.ts` and `shared/scenes/*.json`, not chrome tokens.

- Palettes are four colors (`bg wash, primary, secondary, accent`); the accent should occupy ≤ 10% of the frame. One palette per scene may be near-monochrome; none may be a rainbow.
- Base art is silhouette: 1–2 ink tones, no interior detail, no outlines around fills. The room's choices should change ≥ 60% of what you see.
- Grain: `grainAmount` 0.08–0.30, never 0 (a little grain hides banding on 6-bit laptop panels) and never above 0.35 (muddy).
- Vignette 0.15–0.40. Deeper vignette on "night" palettes.
- Mood watermark: Display 800, width ≈ 40% of canvas, centered in the lower third, opacity 0.06–0.10 of `--text-primary`, blended `multiply` on light washes and `screen` on dark ones. It is part of the art, not a label; it should be readable only on purpose.
- Fog and steam are soft (blurred, low alpha, many); sparks and dust are sharp (small, few, brighter). Do not mix soft and sharp kinds in one preset.
- Flicker presets are rare and small (`motionArea ≤ 0.25`, `motionRateHz ≤ 3`, enforced); a "neon buzz" is a flicker on the sign only, never on the sky.
- Option labels are evocative, scene-specific, ≤ 18 characters so they fit a 72 px phone button in Display 22.

---

## 10. Never do

1. **Generic gradients.** No purple-to-blue, no rainbow, no "AI" gradient text. The only gradient is the text scrim (§2.2) and the two blooms.
2. **Glassmorphism everywhere.** No `backdrop-filter`; it costs frames on a laptop GPU already drawing the artwork. Panels are flat `surface-1/2` at ≤ 72% opacity with a hairline.
3. **Default fonts.** No `system-ui`, Arial, Helvetica, Roboto, or Inter as display. A screenshot showing the fallback stack is a bug.
4. **Cluttered chips.** No rows of tags, filters, or "AI-powered" badges. Role badges (≤ 5, bottom strip) and the single "Reimagined with Gemini" tag (D-43) are the only chips in the product.
5. **Pure white on pure black** (`#FFF` text on `#000`): glare and halation on glossy and OLED laptop panels. Use the tokens.
6. **Drop shadows, inner glows, 3D bevels, or neon text-shadow** in the chrome. Light comes from the artwork, not the UI.
7. **Spinners, toasts, modals, or progress bars on the big screen.** Breathing dots for waiting; the host page holds the diagnostics.
8. **Text over the artwork without a scrim**, and any text under 24 px at 1080p on the screen or under 14 px on phones.
9. **More than one accent**, role hues on buttons, or color as the only carrier of meaning (every badge has a label; the urgent countdown also pulses).
10. **Animating layout** (`width/height/top/left`), bouncing anything outside the four reveal stamps, or any chrome oscillation above 1 Hz. No confetti libraries, no particle explosions beyond the one bloom.
11. **Emoji as icons**, stock illustration, or any logo/character that resembles a real brand or trademark (the diner sign is generic, the vigilante is generic).
12. **Light-mode phone page.** Phones are held up in a dim room; they must not become flashlights.
13. **Centered walls of text.** Verdict and comments are left-aligned in a ≤ 60% column.
14. **Placeholders at reveal.** No empty score slots, no "waiting for Reimagined" panels, no "Creator 4" ghosts. Absence is omitted, not labeled.

---

## 11. Visual QA checklist (score screenshots 0–10)

One point per item. An agent scores a set of screenshots (`/screen` lobby, live, locked, rating, reveal; `/play` creator, spectator, rating, done) and reports failures with the fix. **Pass = 9/10 with no fail on items 4, 7, or 10.** Pair with the [visual-qa skill](../.cursor/skills/visual-qa/SKILL.md) for the motion and fps checks that need video.

1. **Dark frame, bright art.** Chrome backgrounds sample within ±8 of `#0B0B0F`/`#15151C`/`#1F1F29`; the artwork region has a higher mean luminance than any chrome region; the QR card is the only large near-white area.
2. **One accent.** The only saturated UI hue is `#FFB45A` (or `#FF6B5E` in the last-10-s countdown). Role hues appear only inside badges, the credits strip, or the Creator's card, never on buttons or body text.
3. **Correct fonts.** Countdown, prompt, scores, and title card are Bricolage Grotesque (single-story `a`, wide round `o`); captions and body are Instrument Sans. No fallback-stack rendering anywhere.
4. **Contrast and size floors (hard fail).** Big screen: no text under 24 px at 1080p, all text ≥ 7:1 against its own surface; phone: no text under 14 px, all ≥ 4.5:1; `--text-muted` never appears on `/screen`.
5. **Safe area and grid.** Nothing textual within 5% of any screen edge; margins and gaps are multiples of 4 px from the allowed steps; phone side padding is 20 px.
6. **Surfaces and shape.** Every panel has a 1 px hairline and a flat fill; radii are 12 px (cards), 16 px (phone buttons), or pill (badges); no shadows, blur, or gradients other than the bottom scrim.
7. **Phone ergonomics (hard fail).** Every tappable element ≥ 56 px on its shortest side; option buttons are 72 px tall, full width, single column; the primary action sits in the bottom 60% of a 390×844 viewport; selected state is accent fill with dark ink.
8. **Scrims and overlays.** Any text drawn over the artwork sits on the bottom scrim or a `surface-1` panel; during `live` the only chrome is the top bar and bottom strip; during `rating` the bottom rail is present and draining.
9. **Reveal composition.** In the reveal screenshot: three score cards top-to-bottom with labels, a larger combined numeral, the compressed prompt at top, the artwork at ~78% scale on the left; null scores show an em dash with a caption, never an empty card; a 3-Creator round shows exactly three credit badges with no gaps or placeholders.
10. **Content safety (hard fail).** No element resembles a real brand logo or trademarked character; the mood watermark is ≤ 10% opacity; nicknames shown are ≤ 16 characters and filtered; nothing on screen flickers (compare two frames 333 ms apart: no full-screen luminance swing > 20%).

---

## 12. UI v2: landing, play, host, demo

Applies to `/`, `/play`, `/host`, `/demo`. **`/screen` and `/replay` keep §1–§11 unchanged** and import none of the v2 files (`web/lib/chrome/ui.css`, `boids.ts`, `mark.ts`, `icons.ts`). Both generations share the same dark world, the same sodium, and the same two faces, so a laptop running `/host` beside a fullscreen `/screen` reads as one product.

### 12.1 Thesis

A murmuration has no leader and no centre. The v1 pages were centred columns of cards; v2 is **a flight line**: one hard left edge everything hangs from, small-caps metadata on that edge, display type pushed hard to the right, and the empty right side is where the flock lives. The same structure is the phone's spine (a vertical detent rail beside the option keys), the host's transport bar, and the demo's progress rail.

### 12.2 What changed and why

| Area | v1 (§1–§10) | v2 | Why |
|---|---|---|---|
| Layout | centred `max-width` columns, cards | asymmetric: left rail + right field; sections with ghost numerals `01–04`; cards only where something is genuinely a card (QR, "You made this") | a flock is a field, not a card; negative space is the composition |
| Wordmark | type only, "no logo glyph" (§8) | type + **the Turn**: a seeded cluster of 24 dots in a leaning teardrop with a trailing tail (`mark.ts`, `public/mark.svg`, `public/favicon.svg`; 9-dot compact) | a mark that is literally a flock, generated from our own geometry, animatable: the landing flock starts gathered *as* the mark and takes flight |
| Flock motif | 40–80 dots on a noise field (`flock.ts`) | a boid flock (`boids.ts`, ≤ 240 birds, each a 2-point oriented dash that collapses to a dot at rest), separation/alignment/cohesion, avoids the pointer, modes: roam / three groups / settle-to-targets | the product's idea (local rules, one shape) is shown, not decorated; `/screen` keeps `flock.ts` |
| Role hues | badges, credits, Creator card only | also allowed to **tint the brand flock** when it splits into three groups (landing "three dials", demo lobby); still never on buttons or sentences | the three-flocks-one-shape story needs them |
| Gradients | scrim + blooms only | + a vertical **ink fade** (`ink-0` → transparent) between the flock canvas and text, same family as the scrim; still no colour gradients anywhere | text over the flock must clear 7:1 |
| Shadows / blur | none | **none** (unchanged); no `backdrop-filter` | GPU is busy with the artwork |
| Type | fixed `wdth 100` | Bricolage's width axis is expressive: statements step `wdth 75 → 100` across lines ("Three people. Three dials. One artwork."); ghost numerals Display 800 at 10–14% `--bone` | tension in the scale without a second family |
| Neutral | 3 text tones | + `--ink-1 #121218` (large recessed fields: phone frame, console groups) and `--bone #D9D2C5` (ghost numerals, large low-emphasis display) | a secondary neutral for scale contrast; both pass the §2 rules (bone on ink-0 = 13.5:1) |
| Icons | lock + connected dot | 2 px stroke 24 px custom set in `icons.ts`: lock, check, arrow, back, speaker, speaker-off, replay, external, close; never emoji | the four surfaces need affordances |
| Motion | 240/480 ms enters | **weight and lag**: enters translate 16–24 px over 480 ms `--ease-standard`; list items stagger 60 ms as a wave (≤ 8 items); the phone needle slides between detents in 240 ms; still nothing oscillates > 1 Hz, overshoot only in the reveal stamps | motion that travels through a group like a murmuration wave |
| Phone | a form | an **instrument**: option keys (72 px) along a vertical detent rail with a sodium needle; countdown as numeral + 2 px rail draining left to right; rating keys as a bank of five; `vibrate` unchanged | one hand, one dial |
| Host | three cards | a **console**: transport bar (code, cue strip lobby→reveal, countdown, Open big screen), groups Run / Room / Monitor; CSS transforms and opacity only, the QR is the only canvas | dense, legible, cheap |
| Cursor | default | landing and demo: a 16 px ring cursor (`public/cursor.svg`); interactive elements keep `pointer` | one small craft detail; never on phone or host |

Everything in §2 (contrast floors), §4 (56 px targets, 72 px keys, bottom-60 % primary action, 20 px phone padding), §5.3 rules 1–2 and 5–8, §9 and §10 items 1–3, 5–9, 11–14 is **not relaxed**. §10 item 4 (no chips) stands except the progress rail on `/demo`, which is a stepper, not tags.

### 12.3 Added tokens

```
--ink-1: #121218;   --bone: #D9D2C5;
--dur-enter: 480ms; --stagger: 60ms;  --shift: 24px;  (16px on phones)
```

### 12.4 `/demo` (offline, no Firebase)

Eight steps, Back allowed, never a dead end, ≤ 90 s: Welcome · Palette · Form · Motion · Lock · Rate · Reveal · Done. The big-screen panel is the **real renderer** (`mountRenderer` + `resolveTarget`, bundled scene, fixed seed 7); the phone panel reuses the `/play` instrument styles. Narration is static MP3 per step (`/narration/demo/step-NN.mp3`, generated once by `functions/scripts/genDemoNarration.ts`), unlocked by the first Start tap, with mute and replay; on-screen copy carries the whole story if a file is missing. The reveal computes Author from the scene's ranks and Audience from your rating plus a canned room through `shared/scoring.ts`; the AI card is a labelled example.
