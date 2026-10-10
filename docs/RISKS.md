# RISKS — Murmuration

> Top risks ranked by (likelihood × demo impact), each with a mitigation that is already in the design, plus the failure matrix required by the brief (§18.6). Owner column = who watches it during the build.

## 1. Top risks

| # | Risk | L | I | Mitigation (built in) | Trigger to act | Owner |
|---|---|---|---|---|---|---|
| R1 | **No API credentials arrive, or arrive late** (Gemini, ElevenLabs, Tiger) | High | High | Every external call is behind `/config/flags` with a canned result: pre-written per-scene judge comments and scripts, pre-generated fallback mp3s (or browser `speechSynthesis` if no ElevenLabs key ever appears), Reimagined panel hidden. P0 is complete with zero keys by design. | Hour 10: any key still missing → its feature is demoted to "if it arrives" and no further hours are spent on it. | Dev B |
| R2 | ~~Adobe Express Embed SDK not approved~~ Closed by D-37: the poster is p5 only. | — | — | — | — | — |
| R3 | **Venue WiFi congestion / phones dropping** | High | High | Discrete tiny writes (no drag streams), one RTDB connection per phone, `.info/connected` banner and disabled buttons while offline, host hotspot as backup network, bots to run a crowdless round, recorded backup video. | More than 20% of phones show "Reconnecting" → switch the laptop and demo phones to the hotspot. | Host |
| R4 | **Host laptop cannot hold 60 fps** (it runs `/screen` and `/host` at once, D-38) | Med | High | `pixelDensity` cap 1.5, canvas max 1920×1080, base art pre-rendered once, adaptive particle cap with floor, no per-frame allocations. `/dev` shows an fps counter. | Rolling frame time > 20 ms on the demo laptop, plugged in, `/host` open, at hour 20 → lower `PARTICLE_CAP`, disable grain shader path. | Dev A |
| R5 | **Verdict (Gemini + TTS) slower than the rating window** | Med | Med | Adaptive window 12–25 s; judge call starts at lock, not at reveal; one Gemini call does both judge and script; audio cached by hash; canned fallback after 25 s. | p95 judge latency > 20 s in testing → switch `geminiModel` to the lite model via flags. | Dev B |
| R6 | **Gemini SDK surface differs from docs** (docs show `interactions.create` + `response_format`) | Med | Med | Pin `@google/genai` version; smoke test one structured-output image call at hour 0; raw REST path as fallback; response post-validated regardless of transport. | Smoke test fails → use REST for the whole event. | Dev B |
| R7 | **Host or screen refresh mid-round corrupts state** | Med | High | All state is in RTDB and derived from timestamps; host re-evaluates transitions on load; `statusVersion` guards stale callbacks; rules enforce `endsAt` with server `now`; judge call idempotent via transaction; screen re-renders deterministically from seed. | Covered by a scripted test at hour 16: refresh host and screen during live, locked, and rating. | Dev B |
| R8 | **Gemini Reimagined drifts from the artwork, is blocked by safety filters, slow, or not covered by billing** (D-36; no structure-strength knob) | Med | Low | Prompt says "keep the composition, positions, sizes, colors; add nothing"; generic wording only; 60 s cap; result appears only when ready; never on the reveal's critical path; tuned once with a real locked snapshot. | Output unrecognizable after 3 prompt tweaks → try `imageFallbackModel`; still bad → Flux image-to-image via fal.ai behind the same contract, or leave `reimagineEnabled` off. Billing error → enable billing or leave it off. | Dev B |
| R9 | **Slot races, duplicate roles, join storms** | Low | High | Only the host writes `slots`; rules check `slots[role] == auth.uid`; ratings write-once; `events` append-only; joins are independent keys. | Rules emulator tests before P1. | Dev B |
| R10 | **Abusive nickname or scene content on the shared screen** | Med | Med | Blocklist + leet normalization + 16-char limit; host rename/remove; screen hides `removed` players; nicknames never sent to AI; P3 scenes moderated fail-closed and private until approved; Report button. | Host sees anything questionable → remove, which also clears the slot. | Host |
| R11 | **Scope creep with 2 devs (or 1)** | High | High | Hard cut line after P1; hourly checkpoints; P3 is a slide unless P2 is done by hour 30; solo plan predefined. | Checkpoint h10 or h18 missed by > 2 h → drop texture/mood polish and Reimagined. | Both |
| R12 | **Blaze billing or quota surprise** | Low | Med | Budget alert at $10 in Google Cloud; per-session caps on judge calls, TTS chars, Reimagined calls; flags can switch everything off. | Any alert → flip flags, demo keeps working. | Dev B |
| R13 | **Scene art takes longer than planned** | Med | Med | Placeholder base art (a few rectangles and circles) exists from hour 2 so the pipeline is never blocked; a non-dev can author SVG paths in any vector tool and paste `d` strings into JSON. | Hour 14: a scene has no real art → ship it with stylized minimal shapes and lean on the live layer. | Dev A / content |
| R14 | **Browser audio autoplay blocks the verdict** | Med | Med | `/screen` requires one click ("Start session") which unlocks `AudioContext`; verdict plays through a pre-created `Audio` element; host has a manual Play button. | Audio fails at rehearsal → host presses Play. | Dev A |
| R15 | **Tiger connectivity from Functions** (cold-start pool, TLS/cert, venue egress, service paused, 30-day credit expiry, `tsdb.hypertable` syntax unsupported on the service's version) | Med | Low | `tigerEnabled` flag; `logRoundEvents` is fire-and-forget with `TIGER_TIMEOUT_MS = 5000` and runs after reveal, so it can never delay the room; `ON CONFLICT DO NOTHING` makes retries safe; `sessionPulse` returns `stale: true` and the host panel keeps its last payload; DDL has the `create_hypertable()` fallback noted in DATA_SCHEMA §8. | `SELECT 1` fails at hour 0 → fix TLS/connection string before writing any Tiger code; still failing at h22 → ship mirror code behind the flag and demo the panel from a seeded local run. | Dev B |
| R16 | **Sponsor-track dilution** (temptation to bolt on Solana, Vultr, or Auth0 for extra prizes) | Med | Med | D-33 declines all three with reasons; the pitch names four truthful integrations. | Anyone proposes it after h10 → point to D-33. | Both |

## 2. Failure matrix (brief §18.6)

| Failure | Detected by | Immediate behaviour | Fallback shown to the room | Recovery |
|---|---|---|---|---|
| **WiFi drops on a phone** | `.info/connected == false` on `/play` | Buttons disabled, "Reconnecting" banner; last choice already on the server stands | Nothing changes on screen; the role's last choice (or neutral) continues | Firebase SDK reconnects; queued writes flush only if still inside the time window (rules reject late ones) |
| **WiFi drops on the host laptop** | `.info/connected == false` on `/host` | Host timers keep running locally but writes queue; status transitions are delayed | Screen keeps rendering the last known state; countdown continues from `startsAt` | On reconnect, the host re-evaluates transitions from `serverNow()` and writes the correct status; switch to hotspot if persistent |
| **WiFi drops on the screen** | `.info/connected == false` on `/screen` | Keeps rendering with current params; small "offline" dot | Canvas still animates (deterministic from local clock) | Reconnects and catches up; if lock was missed, it renders the locked frame on resume |
| **Gemini timeout or error** | `judgeRound` catch / 12 s timer | Writes `results.ai = canned{score, comment, fallback:true}` and canned script | AI score shows with a small "(offline judge)" tag; verdict plays canned audio | Flags can switch to the lite model; next round retries normally |
| **Gemini returns invalid JSON or script out of spec** | post-validation in `judgeRound` | One retry with the fallback model; then canned | Same as above | — |
| **Gemini moderation error (P3)** | `moderateScene` catch | `{approved:false, category:"error"}`; scene stays private | "Content not suitable / moderation unavailable, try again later" | Author can retry; nothing is ever published on error (fail closed) |
| **ElevenLabs failure or timeout** | `judgeRound` catch / 10 s timer | `verdict.audioUrl` = pre-generated fallback clip for the scene; `ready:true` | Scores reveal on time; a canned verdict plays; the written script is still shown as text on screen | Cache means a repeated script never re-hits the API |
| **No ElevenLabs key at all** | `voiceEnabled=false` | Skip TTS | Script shown as text; optional browser `speechSynthesis` on the laptop | — |
| **Reimagined (Gemini image) failure, slow, or filtered** | `reimagineRound` error / 60 s cap | `results.reimagined.status = "failed"` or `"skipped"` | Panel never appears; nothing else changes | Host can tap "Retry reimagine" once |
| **Quota or cap hit (any API)** | `meta.usage` vs flags caps, or 429 | Function returns canned result without calling the API | Same as the corresponding fallback | Raise cap in flags if intentional |
| **Tiger unreachable or slow** | `logRoundEvents` / `sessionPulse` timeout (5 s) or connection error | Mirror returns `ok:false`; host retries once at NEW_ROUND; pulse returns `stale:true` | Nothing; the room never sees Tiger. `/host` panel shows its last cached values with a "stale" badge | Fix connection string / TLS; re-run `logRoundEvents` for missed rounds from `/host` ("Re-sync Tiger" button) |
| **Domain DNS not propagated by demo** | `https://<domain>` does not resolve or shows a cert warning | QR falls back to the `*.web.app` Firebase Hosting URL (host toggle) | Slightly longer URL under the QR | Domain still counts for the GoDaddy prize; propagation usually completes within hours |
| **Host refresh mid-round** | `/host` load | Reads `round`; applies any overdue transition immediately | Room may see the lock or reveal a second late; nothing is lost | None needed |
| **Screen refresh mid-round** | `/screen` load | Re-subscribes; re-renders from seed + choices + `t`; if judge not yet requested and status ≥ locked, performs the snapshot step | Brief black frame, then the same artwork | None needed |
| **Creator disconnects mid-round** | `players/{uid}/connected=false` via `onDisconnect` | Their last choice stands; red dot on `/host` | Artwork unchanged; dial owner still credited | Host may reassign the slot to the next Spectator in queue |
| **Creator never picks anything** | no `choices/{role}` at lock | Role uses the neutral preset; Author score averages only filled/chosen roles | Looks intentional; credit still shows the dial owner | — |
| **Nobody joins** | Host sees 0 players | Host taps Add bots (3 or 5) | Bots appear as "Bot Priya" etc.; full round runs | — |
| **Fewer than 3 join** | Host sees < 3 | Start disabled until bots fill to 3 | Same | — |
| **Two phones claim a role** | Cannot happen; host is the only slot writer | Rules reject the non-owner's `choices` write | — | — |
| **Near-simultaneous changes** | Normal | Last write wins per role; events keep both | Smooth easing to the final target | — |
| **Join storm (30 phones in 10 s)** | Normal | Independent small writes; host reads | Lobby count ticks up | — |
| **Abusive nickname** | Client filter, then host eyes | Filter replaces with `Guest-xxxx`; host can rename/remove | Removed players vanish from screen and lose their slot | — |
| **Abusive scene (P3)** | `moderateScene` | Not published; author sees "Content not suitable" | Nothing | Report button + admin remove for anything that slips through |
| **Stale QR from a previous session** | Different `code` | Phone joins the old session's lobby | Host's screen shows the new code; the phone sees "This session has ended, scan again" when `meta.endedAt` exists | Host taps End session on the old one |
| **Browser blocks audio autoplay** | `play()` rejects | Host sees "Audio blocked" | Host presses Play | Screen unlock click at session start prevents this |
| **Laptop viewport unexpected** (Windows scaling, 16:10 panel) | `/screen` load | Canvas scales to window, capped at 1920×1080; `viewBox` scaling keeps composition; chrome sized in `vw`/`vh` | Letterboxed with `ink-0` bars if aspect differs | — |
| **Deploy breaks before demo** | Smoke test after deploy | Roll back to last tag (`v1`) with `firebase hosting:clone` or redeploy from the tag | — | Feature freeze at hour 30 makes this unlikely |
| **Everything is on fire** | — | Play the recorded full run | — | Recorded at hour 30 on the demo laptop |

## 3. Pre-demo checklist (hour 34)

- Flags set to the real state of each key; caps sane; `tigerEnabled` true only if `SELECT 1` works from a deployed function.
- Domain resolves over HTTPS; QR points at it (or the host has toggled the fallback URL).
- Three fallback verdict clips present per scene in Storage.
- Host phone on hotspot; laptop on hotspot, plugged in, brightness max, Night light off, same display scaling as rehearsal; audio unlocked.
- `/host`, `/screen` open on the laptop with the live session code; two team phones joined.
- Backup video on the laptop desktop.
