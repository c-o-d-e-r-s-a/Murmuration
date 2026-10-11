# SETUP — accounts, codes, keys (do before kickoff)

> Ordered checklist for the owner. Each step is independent; do them in any order, but finish 1–5 before hour 0 if possible. Secrets go into Cloud Functions secrets only (D-02, brief §14). Nothing secret is ever written into `web/`, `shared/`, or git; `.env*` and service-account files are already ignored.
> Sponsor decisions: [DECISIONS D-33/D-34](DECISIONS.md). What each key unlocks: `/config/flags` in [DATA_SCHEMA §2](DATA_SCHEMA.md).

## 0. Where things go

| Thing | Where | Set with |
|---|---|---|
| Firebase web config (apiKey, databaseURL, projectId, storageBucket, appId) | `web/lib/firebase.ts` (public by design) | paste from console |
| `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `TIGER_DATABASE_URL` | Cloud Functions secrets | `firebase functions:secrets:set NAME` |
| Feature flags, caps, `ttsVoiceId`, `ttsModelId`, `imageModel` | RTDB `/config/flags` | Firebase console → Realtime Database |
| Domain | Firebase Hosting → Custom domains; DNS at GoDaddy | consoles |

Keep a private note (not in the repo) of every promo code, login, and the Tiger connection string.

## 1. Firebase (required for everything)

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project `murmuration` (or similar). Disable Analytics.
2. Upgrade to **Blaze** (needed for Functions and Storage; [Storage docs](https://firebase.google.com/docs/storage/web/start)). Google Cloud → Billing → Budgets: alert at $10.
3. Build → Authentication → Sign-in method → enable **Anonymous**.
4. Build → Realtime Database → Create (US region) → start in locked mode; rules will come from `database.rules.json`.
5. Build → Storage → Get started (US-CENTRAL1 for the free tier).
6. Build → Hosting → Get started. Note the `*.web.app` URL; it is the QR fallback (RISKS failure matrix).
7. Project settings → Your apps → Add web app → copy the config object.
8. Create `/config/flags` in the database with every flag `false` and the caps from DATA_SCHEMA §2. Flip flags to `true` only after the matching key works.

Verify: `firebase deploy --only hosting` of an empty page loads at the `*.web.app` URL.

## 2. ElevenLabs (Best Use of ElevenLabs)

**Chosen (O-05):**

| | Value |
|---|---|
| Voice | **Ed – Sarcastic Funny narrator**, `ttsVoiceId: "3IwIPyXc0WRkgKBE8KXP"` |
| Model | `ttsModelId: "eleven_v4_turbo"` (~100 ms, expressive, supports audio tags like `[sarcastic]`, `[laughs]`) |
| Fallback model | `eleven_flash_v2_5` (~75 ms, half price, **no audio tags**; strip `[...]` from the script if you switch) |

Model docs: [models](https://elevenlabs.io/docs/models). Latency barely matters here (audio is generated after lock, inside the 12–25 s window, D-15), so pick for expressiveness; v4 Turbo gives the best delivery per millisecond.

1. You are registered, so the promo arrives the week of the event: [MLH ElevenLabs steps](https://www.mlh.com/partners/elevenlabs). Follow the link in the email; it creates the account with the free 3-month subscription.
2. Profile → API Keys → create one. **Never paste it into this file or anything under `web/`, `shared/`, `docs/`.** It goes in exactly two places:
   - Deployed: `firebase functions:secrets:set ELEVENLABS_API_KEY` (paste when prompted).
   - Local emulator: `functions/.secret.local` → `ELEVENLABS_API_KEY=sk_...` (gitignored).
3. Voice: if the test below returns `voice_not_found`, open the voice in the Voice Library and click **Add to My Voices**, then retry.
4. Model: confirm the REST TTS endpoint accepts v4 Turbo (the docs list v4 under Text to Dialogue). In PowerShell:
   ```powershell
   $k = Read-Host "ElevenLabs key"
   (Invoke-RestMethod https://api.elevenlabs.io/v1/models -Headers @{ "xi-api-key" = $k }) |
     Where-Object model_id -in "eleven_v4_turbo","eleven_flash_v2_5" |
     Select-Object model_id, can_do_text_to_speech
   ```
   If `eleven_v4_turbo` shows `False`, use `eleven_flash_v2_5`.
5. In `/config/flags` set `ttsVoiceId: "3IwIPyXc0WRkgKBE8KXP"`, `ttsModelId: "eleven_v4_turbo"`, then `voiceEnabled: true` once the test passes.

Verify (same PowerShell session; writes `test.mp3`, under 10 s):

```powershell
$body = @{ text = "[sarcastic] Oh, wonderful. Three strangers, one canvas, and somehow it looks like a screensaver had a bad breakup. [laughs] Honestly? I respect the commitment."; model_id = "eleven_v4_turbo" } | ConvertTo-Json
Measure-Command { Invoke-RestMethod -Method Post -Uri "https://api.elevenlabs.io/v1/text-to-speech/3IwIPyXc0WRkgKBE8KXP?output_format=mp3_44100_64" -Headers @{ "xi-api-key" = $k } -ContentType "application/json" -Body $body -OutFile test.mp3 }
```

Play `test.mp3`; the tags should change the delivery, not be read aloud. Delete it after.

## 3. Gemini API (Best Use of Gemini API)

1. Credits: [MLH Gemini page](https://www.mlh.com/partners/gemini). Student plan if eligible; otherwise the $300 new-account Google Cloud credit or the $10/month program benefit.
2. [Google AI Studio](https://aistudio.google.com) → Get API key (same Google account as the Firebase project is simplest). `firebase functions:secrets:set GEMINI_API_KEY`.
3. Hour-0 smoke test (RISKS R6): one structured-output call with an inline JPEG and the `{score, comment, script}` schema using `gemini-3.8-flash` ([structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [models](https://ai.google.dev/gemini-api/docs/models)). If the pinned `@google/genai` surface differs from the docs, switch `lib/gemini.ts` to the REST path and move on.
4. Set `aiEnabled: true`.
5. Reimagined render (D-36), same key, no extra setup in Google: the image models have **no free tier** ([pricing](https://ai.google.dev/gemini-api/docs/pricing): ~$0.034 per 1K image for both `gemini-nano-banana-2.1` and `gemini-3.1-flash-lite-image`), so create the AI Studio key in (or import) the Blaze project `murmuration-33d60`; a key in AI Studio's default project has no billing and image calls will fail. The $300 Google Cloud trial credit does **not** pay for the Gemini API ([billing](https://ai.google.dev/gemini-api/docs/billing)); AI Studio → Billing → Buy credits (Prepay, minimum $5, ~145 images). Eligible promo credits (e.g. MLH) are consumed first once a Prepay balance exists. At $0 balance every key on the billing account returns 402 and the judge falls back to canned, so buy $10 or enable auto-reload before the demo. Vertex AI was considered and skipped: different call surface and model ids, IAM setup, ~1 ph, to save $5. Smoke test once with any 16:9 JPEG and the prompt in [CONTRACTS §8](CONTRACTS.md); note the latency; it must finish well inside 60 s. Then set `imageModel: "gemini-nano-banana-2.1"`, `imageFallbackModel: "gemini-3.1-flash-lite-image"`, `maxReimaginePerSession: 10`, `reimagineEnabled: true`.

## 4. Tiger Data (Best Use of Tiger Data)

1. Sign up through the MLH link so the $1,000 / 30-day credit applies: mlh.link/tigerdata-quickstart ([MLH Tiger Data](https://www.mlh.com/partners/tigerdata)).
2. Tiger Cloud console → Create service → smallest compute, **AWS us-east-1** (closest to Functions in `us-central1` with low latency), TimescaleDB enabled. Save the password shown once.
3. Copy the connection string (`postgres://tsdbadmin:...@...tsdb.cloud.timescale.com:5432/tsdb?sslmode=require`). `firebase functions:secrets:set TIGER_DATABASE_URL`.
4. Open the SQL editor (or `psql`) and run `functions/sql/tiger.sql` from [DATA_SCHEMA §8](DATA_SCHEMA.md). If `WITH (tsdb.hypertable)` errors, use the `create_hypertable()` form noted there.
5. Set `tigerEnabled: true` only after step 6.

Verify: `SELECT * FROM timescaledb_information.hypertables;` lists `round_events`; `SELECT * FROM timescaledb_information.continuous_aggregates;` lists `choices_10s`; a deployed function can run `SELECT 1`.

Docs: [TimescaleDB reference](https://www.tigerdata.com/docs/reference/timescaledb), [continuous aggregates](https://www.tigerdata.com/docs/use-timescale/latest/continuous-aggregates/), [getting started](https://www.tigerdata.com/docs/getting-started/latest/).

## 5. GoDaddy domain (Best Domain Name)

1. Registered at GoDaddy: **`mybossdoeslameicebreakers.work`** (joke direction, D-34).
   The QR encodes `https://<domain>/play?s=CODE`, so a long joke name is fine; nobody types it.
2. Firebase Hosting → Add custom domain → enter the domain → copy the TXT and A records.
3. GoDaddy DNS → add those records. Propagation and the certificate take minutes to a few hours; keep the `*.web.app` fallback toggle on `/host`.

## 6. Adobe: nothing to set up (D-36, D-37)

Adobe sponsors the Creative track without a product challenge and could not issue Firefly credentials, so there is no Adobe console project, secret, or domain allowlist. The Reimagined render uses Gemini (§3 step 5); the poster is p5. Adobe apps (Illustrator for scene SVGs, Express for slides) are fine to use by hand; nothing in the build depends on them.

## 7. Local tooling

- Node 24 LTS, `npm i -g firebase-tools`, `firebase login`, `firebase init` (Hosting, Functions TS, Realtime Database, Storage, Emulators).
- Git: `git init`, commit `docs/` now (so no file disappears again), create `.gitignore` with `node_modules/`, `dist/`, `.env*`, `!.env.example`, `.firebase/`, `*.local`.
- Optional: `psql` or the Tiger web SQL editor; a QR app on your phone for testing.

## 8. Skip (D-33)

Do not create Solana, Vultr, or Auth0 accounts for this project. Vultr's $100 credit is free to claim if you want it for something else, but nothing in Murmuration runs there.

## 9. Hour-0 checklist (tick before writing feature code)

- [ ] Firebase project on Blaze, five services on, web config copied, `/config/flags` created (all false)
- [ ] `GEMINI_API_KEY` set; smoke test passed or REST fallback chosen; one image-editing test returned a PNG (billing on if needed)
- [ ] `ELEVENLABS_API_KEY` set; `ttsVoiceId`, `ttsModelId` in flags; one test clip generated
- [ ] `TIGER_DATABASE_URL` set; `tiger.sql` applied; `SELECT 1` from a function
- [ ] Domain registered; Hosting custom domain pending or live
- [ ] Repo initialized, `docs/` committed, `.gitignore` in place
