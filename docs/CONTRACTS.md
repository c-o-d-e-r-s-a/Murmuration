# CONTRACTS — Murmuration

> Everything the big screen, the phones, the host page, and the backend must agree on. All of this lives in one file, `shared/contracts.ts` (plus `shared/scoring.ts`, `shared/presets.ts`), imported by `web/` and `functions/`. If a value is not here, it is not shared.
> External API shapes are quoted from the referenced docs; anything marked *verify at event* was not confirmed in the docs fetched during planning.

## 1. Shared constants

```ts
export const ROLES = ["palette", "form", "motion", "texture", "mood"] as const;   // also the fill priority
export const MIN_CREATORS = 3;
export const MAX_CREATORS = 5;
export const OPTIONS_PER_ROLE = 4;
export const AUTHOR_RANK_SCORES = [10, 7, 4, 1] as const;

export const DURATIONS_MS = [60000, 90000, 120000] as const;
export const DEFAULT_DURATION_MS = 90000;
export const SETTLE_MS = 1500;
export const RATING_MIN_MS = 12000;
export const RATING_MAX_MS = 25000;
export const RATING_EXTEND_STEP_MS = 3000;
export const RATING_GRACE_MS = 3000;          // rules allow votes until ratingEndsAt + grace
export const HOST_TICK_MS = 250;              // host timer poll

export const NICK_MAX = 16;
export const NICK_MIN = 1;
export const OPTION_ID_MAX = 32;
export const OPTION_LABEL_MAX = 28;
export const PROMPT_TEXT_MAX = 120;
export const SESSION_CODE_LEN = 4;
export const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const SNAPSHOT_W = 1280;
export const SNAPSHOT_H = 720;
export const SNAPSHOT_JPEG_QUALITY = 0.8;      // ~150-300 KB; Gemini inline limit is 20 MB total request

export const CANVAS_MAX_W = 1920;
export const CANVAS_MAX_H = 1080;
export const PIXEL_DENSITY_CAP = 1.5;
export const PARTICLE_CAP = 1200;
export const PARTICLE_FLOOR = 150;
export const FRAME_BUDGET_MS = 20;             // above this, halve particles

export const EASE_NUMERIC_MS = 600;            // time constant for numeric params
export const EASE_PALETTE_MS = 900;            // color crossfade
export const FLICKER_MAX_HZ = 3;               // photosensitivity; enforced in presets.ts
export const FLICKER_MAX_AREA = 0.25;          // fraction of canvas any flicker may affect

export const ENERGY_WRITE_THROTTLE_MS = 150;   // P2 energy dial only (D-08)

export const GEMINI_TIMEOUT_MS = 12000;
export const TTS_TIMEOUT_MS = 10000;
export const REIMAGINE_TIMEOUT_MS = 60000;     // Gemini image call; skipped after this
export const TIGER_TIMEOUT_MS = 5000;          // logRoundEvents / sessionPulse query budget; failure is silent
export const TIGER_BUCKET_SECONDS = 10;        // continuous aggregate bucket for the session pulse panel
export const PULSE_POLL_MS = 10000;            // /host polls sessionPulse while the panel is open
export const VERDICT_WORDS_MIN = 40;
export const VERDICT_WORDS_MAX = 60;

export const SCORE_WEIGHTS = { author: 1, ai: 1, audience: 1 };   // equal to start
```

## 2. Enums and types shared across pages

```ts
export type Role = typeof ROLES[number];
export type RoundStatus = "lobby" | "live" | "locked" | "rating" | "reveal";
export type PlayerRole = "creator" | "spectator";
// Round, Player, Choice, ChoiceEvent, Results, Scene, Option, Prompt, Preset: see DATA_SCHEMA.md
```

## 3. Realtime messages (what each client writes; payload limits)

RTDB is the message bus; "message" = a write to a path. Every write is a plain JSON object with no nesting deeper than one level, except the host's multi-path updates.

| Message | Writer | Path | Shape | Max bytes |
|---|---|---|---|---|
| JOIN | phone | `players/{uid}` | `{nick, joinedAt: serverTimestamp(), connected: true, lastSeen: serverTimestamp(), role: "spectator", slot: null, queuePos: <serverTimestamp as ordering>}` | 160 |
| PRESENCE | phone, screen, host | `players/{uid}/connected` + `onDisconnect` → `{connected:false, lastSeen: serverTimestamp()}` | 40 |
| NICK | phone / host | `players/{uid}/nick` | string 1–16 after client filter | 32 |
| CHOOSE | creator phone | multi-path: `choices/{role} = {optionId, uid, at: serverTimestamp()}` and `events/{push} = {t, role, optionId, uid}` | 150 |
| RATE | spectator phone | `ratings/{uid} = 1..5` | 8 |
| ENERGY (P2) | spectator phone | `energy/{uid} = 0..100`, throttled 150 ms | 8 |
| START / LOCK / SETTLED / RATING_DONE / NEW_ROUND / RESET / REROLL | host | see ROUND_STATE_MACHINE §2 | 1 KB |
| ASSIGN_SLOT | host | `round/slots/{role} = uid`, `players/{uid}/{role,slot,queuePos}` | 200 |
| REMOVE_PLAYER | host | `players/{uid}/removed = true`, clears slot if any | 60 |
| ADD_BOTS | host | `players/bot_{n}` records + later bot CHOOSE/RATE writes under the host uid | 160 each |
| JUDGE_REQUESTED | screen | transaction `results/judgeRequestedAt: null → serverTimestamp()` | 20 |
| AUTHOR_SCORE | host | `results/author = {score, perRole}` | 120 |
| AUDIENCE_SCORE | host | `results/audience = {score, count, method}`, `results/combined` | 100 |

Clients ignore any `round` snapshot whose `statusVersion` is lower than the last one they processed.

## 4. Score formulas (`shared/scoring.ts`, pure functions, unit-tested)

All displayed scores are on 0–10 with one decimal.

```
authorScore(scene, choices):
  filled = roles r where choices[r] exists and option is in scene.options[r]
  if filled is empty → null
  score = mean( option.authorScore for r in filled )          // each in {10,7,4,1}
  perRole[r] = option.authorScore

aiScore: integer 1..10 straight from Gemini JSON; clamp to [1,10]; fallback value 6 with fallback:true

audienceScore(ratings[1..5]):
  n = count
  if n == 0 → { score: null, count: 0, method: "none" }
  if n < 5  → { score: 2 * median(ratings), count: n, method: "median" }
  else      → sort; drop floor(0.1*n) from each end; score = 2 * mean(rest); method: "trimmed"

combined(author, ai, audience):
  parts = [ (author, W.author), (ai, W.ai), (audience, W.audience) ] with non-null scores
  if parts empty → null
  combined = Σ score*w / Σ w        // equal weights to start; constants in SCORE_WEIGHTS
```

Ratings are stored as 1–5 and multiplied by 2 for display, so a phone never deals with a 10-point scale.

## 5. Timer contract

- `serverNow()` = `Date.now() + offset`, offset from `.info/serverTimeOffset` ([Firebase docs](https://firebase.google.com/docs/database/web/offline-capabilities)).
- `endsAt = round.startsAt + round.durationMs` (derived everywhere, including rules as `now < startsAt + durationMs`).
- Countdown display = `ceil(max(0, endsAt - serverNow()) / 1000)`.
- Render time `t = serverNow() - startsAt`, clamped to `[0, durationMs]` after lock. Replay uses `t` from the event log, so a replay is frame-equivalent.

## 6. RenderParams (the renderer's single input; presets fill subsets)

```ts
export type RenderParams = {
  // palette
  colors: [string, string, string, string];   // bg wash, primary, secondary, accent (hex)
  washOpacity: number;        // 0..1
  // form (atmosphere/particles)
  particleKind: "fog" | "steam" | "sparks" | "dust" | "none";
  particleDensity: number;    // 0..1 → count = floor(density * adaptiveCap)
  particleSize: number;       // px at 1080p
  particleSpeed: number;      // px/s
  particleDrift: number;      // noise influence 0..1
  // motion (hotspots + global)
  motionKind: "still" | "pulse" | "sway" | "flicker" | "drift";
  motionRateHz: number;       // PROTECTED: clamped ≤ FLICKER_MAX_HZ
  motionAmplitude: number;    // 0..1
  motionArea: number;         // PROTECTED: fraction of canvas ≤ FLICKER_MAX_AREA
  // texture
  grainAmount: number;        // 0..1
  grainScale: number;         // px
  vignette: number;           // 0..1
  // mood
  moodWord: string;           // ≤ 14 chars, drawn as faint watermark
  energy: number;             // 0..1, nudges speed/density multipliers; P2 energy dial writes here too
}
export const PROTECTED_PARAMS = ["motionRateHz", "motionArea"] as const;  // overrides cannot set these
```

Each role's presets touch only their block. `neutral` presets per role: palette = grayscale wash, form = sparse dust, motion = still, texture = light grain, mood = empty word.

## 7. Callable functions (`firebase-functions/v2/https` `onCall`; client `httpsCallable`)

Grounded in [callable functions docs](https://firebase.google.com/docs/functions/callable). All errors are `HttpsError`; clients treat any error as "fallback already written, keep going".

### `judgeRound`
```ts
Request:  { sessionCode: string; roundId: string; snapshotJpegBase64: string }   // ≤ 1.5 MB base64
Response: { ok: true; ai: {score, comment, fallback}; verdict: {script, audioUrl, ready, fallback}; snapshotUrl: string }
Auth:     request.auth.uid must equal meta.hostUid or meta.screenUid; round.id must equal roundId; round.status in ["locked","rating"]
Steps:    1 load flags + meta.usage; 2 store snapshot → Storage; 3 if !aiEnabled or cap hit → canned; else Gemini (≤12 s);
          4 write results.ai + results.verdict.script; 5 if !voiceEnabled or cap → fallback mp3 URL; else cache check → ElevenLabs (≤10 s) → Storage;
          6 write results.verdict{audioUrl, ready:true}; 7 increment usage.
Idempotency: caller already won the judgeRequestedAt transaction; function also refuses if results.ai exists.
```

### `reimagineRound`
```ts
Request:  { sessionCode: string; roundId: string }
Response: { ok: true; status: "pending" | "ready" | "skipped" | "failed"; url?: string }
Auth:     request.auth.uid == meta.hostUid
Steps:    flags/cap → write results.reimagined{status:"pending"} → read snapshot from Storage → one Gemini image call (≤ 60 s, D-36)
          → save image to Storage reimagined/{code}/{roundId}.png → write results.reimagined{status:"ready", url}. Any error or timeout → status "failed" / "skipped".
Called:   by /host at T5, fire-and-forget; /screen only listens to results.reimagined.
```

### `logRoundEvents` (P1-9)
```ts
Request:  { sessionCode: string; roundId: string }
Response: { ok: true; inserted: number } | { ok: false; reason: "disabled" | "timeout" | "error" }
Auth:     request.auth.uid == meta.hostUid; round must be in status "reveal" or already archived under rounds/{roundId}
Steps:    flags.tigerEnabled → read events + results + round from RTDB → one INSERT ... ON CONFLICT DO NOTHING into round_events (batch) and one into rounds → return.
          Any failure is logged and returned as ok:false; the host never shows it to the room.
Called:   by /host once at T5 (fire-and-forget); the host retries once on the next NEW_ROUND if ok was false.
```

### `sessionPulse` (P1-10)
```ts
Request:  { sessionCode: string }
Response: {
  stale: boolean;                                 // true if Tiger was unreachable; payload may be empty
  buckets: { t: string; role: Role; n: number }[]; // from choices_10s, last 15 minutes, ISO timestamps
  topOptions: Partial<Record<Role, { optionId: string; n: number }>>;  // most-chosen option per role this session
  rounds: { played: number; avgCombined: number | null; lastLockedAt: string | null };
}
Auth:     request.auth.uid == meta.hostUid
Polling:  /host every PULSE_POLL_MS while the panel is open; never from /screen or /play.
```

### `moderateScene` (P3)
```ts
Request:  { scene: Scene (draft, kind:"custom"), screenshotJpegBase64: string }
Response: { approved: boolean; category: string; reason: string }
Fail closed: any error → { approved: false, category: "error", reason: "Moderation unavailable" } and nothing is published.
```

## 8. External API call shapes

### Gemini (judge + verdict script in one call) — D-22
Docs: [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) (inline base64 image, 20 MB total limit), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) (JSON Schema response), [models](https://ai.google.dev/gemini-api/docs/models) (`gemini-3.8-flash`, `gemini-3.5-flash-lite`).

Input facts (never nicknames, D-24):
```json
{ "scene": "Atlanta Rush Hour", "prompt": "Make the gridlock feel almost peaceful",
  "choices": { "palette": "Peach Sunset", "form": "Low Fog", "motion": "Slow Drift" },
  "unfilledRoles": ["texture", "mood"] }
```
Response schema (JSON Schema passed as the structured-output schema):
```json
{ "type": "object",
  "properties": {
    "score":   { "type": "integer", "minimum": 1, "maximum": 10 },
    "comment": { "type": "string", "maxLength": 140 },
    "script":  { "type": "string" } },
  "required": ["score", "comment", "script"] }
```
Prompt rules for `script`: 40–60 words; name at least two of the chosen option labels verbatim; one joke, one genuine observation; speak about the artwork and the choices, never about people; no preamble, no quotes. Post-validate: word count in range and ≥ 2 labels present, else retry once with the fallback model, else canned script.

*Verify at event:* the docs fetched show the `@google/genai` SDK using `client.interactions.create({ model, input, response_format: { type: "text", mime_type: "application/json", schema } })`. Pin the SDK version that matches and smoke-test one call at hour 0; keep a raw REST `generateContent` path as fallback if the SDK surface differs.

### ElevenLabs TTS
Docs: [create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64
headers: xi-api-key: <secret>, Content-Type: application/json
body: { "text": <script>, "model_id": <model>, "voice_settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0.3, "speed": 1.05 } }
→ 200 audio bytes → Storage verdicts/{sha256(script)}.mp3
```
`model_id` default per docs is `eleven_multilingual_v2`; a lower-latency model is chosen from `GET /v1/models` at hour 0 and stored in `/config/flags.ttsModelId`; `voice_id` from `GET /v1/voices` into `/config/flags.ttsVoiceId` (O-05). `judgeRound` reads both from flags so they can be swapped without a redeploy. The MLH promo gives a 3-month subscription ([MLH ElevenLabs](https://www.mlh.com/partners/elevenlabs)); per-session `maxTtsCharsPerSession` still applies.

### Gemini Reimagined (image editing) — D-36
Docs: [image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation) (text-and-image-to-image, `response_format`, model list).
```ts
const interaction = await ai.interactions.create({
  model: flags.imageModel,                       // "gemini-nano-banana-2.1"; fallback flags.imageFallbackModel
  input: [
    { type: "text", text: <prompt below> },
    { type: "image", mime_type: "image/jpeg", data: <snapshot base64> },
  ],
  response_format: { type: "image", aspect_ratio: "16:9" },   // image only, no chat text
});
// interaction.output_image.data (base64) → Buffer → Storage reimagined/{code}/{roundId}.png
```
Prompt template (generic words only; no character or brand names; never nicknames, D-24):
> Re-render this exact artwork as a finished {moodWord} painting of {scene title}. Keep the composition, every shape's position and size, and the {palette label} colors. Do not add text, people, logos, or new objects.

No strength knob: if the output drifts, tighten the prompt ("preserve the original composition" is the documented style-transfer phrasing), then try the fallback model. Every output carries an invisible SynthID watermark. Tune once with a real locked snapshot at hour ~20.

### Tiger Data mirror (P1-9/P1-10, D-33)
Docs: [TimescaleDB reference](https://www.tigerdata.com/docs/reference/timescaledb), [continuous aggregates](https://www.tigerdata.com/docs/use-timescale/latest/continuous-aggregates/).
Full DDL lives in [DATA_SCHEMA.md §8](DATA_SCHEMA.md); the contract is:

- `round_events` hypertable, partitioned on `time` (= `round.startsAt + t_ms`, as `timestamptz`), columns `session_code, round_id, role, option_id, uid_hash, t_ms`; unique on `(session_code, round_id, t_ms, role)` so re-logging is a no-op.
- `rounds` plain table, one row per archived round with `scene_id, prompt_id, author, ai, audience, combined, locked_at, duration_ms, creators`.
- `choices_10s` continuous aggregate: `time_bucket('10 seconds', time) AS bucket, session_code, role, count(*) AS n`, refresh policy every 10 s over the last hour, `timescaledb.materialized_only = false` so the latest raw rows are included.
- Writer: `logRoundEvents` only, after reveal, inside `TIGER_TIMEOUT_MS`. Reader: `sessionPulse` only. Nicknames are never written; `uid_hash` is the first 8 hex chars of SHA-256(uid).
- Never read on the live path; `/replay` reads RTDB `rounds/{roundId}`.

## 9. Event log and replay contract

- `events/{push}` = `{ t: ms since startsAt (0..durationMs), role, optionId, uid }`.
- Archived with the round under `rounds/{roundId}/events`.
- `/replay?s=CODE&r=ROUND` loads `rounds/{roundId}`, sets `randomSeed/noiseSeed(seed)`, starts a local clock, applies each event when `localT >= event.t`, and renders with the same `RenderParams` pipeline; at `t = durationMs` it performs the lock/reveal visuals and shows the archived scores.
- OG tags for the link (P2): `og:image = results.snapshotUrl`, `og:title = "<scene title> — <prompt>"`.

## 10. Nickname filter contract (`web/lib/nick.ts`, also run on `/host`)

- Trim, collapse whitespace, strip control characters and emoji-only strings; length 1–16; else use `Guest-{last 4 of uid}`.
- Blocklist: lowercase compare after removing non-letters and common leet substitutions (`0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s`); match on substrings from a ~150-word list kept in `shared/nickBlocklist.ts`.
- Host sees every nick in `/host` before it appears on `/screen` only in the sense that the host list updates first visually; the real safeguard is rename/remove plus the filter.
