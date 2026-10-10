// Everything web/ and functions/ must agree on. Source: docs/CONTRACTS.md, docs/DATA_SCHEMA.md.
// No DOM or Node APIs here; both bundles import this file.

// ---- §1 Shared constants ----

export const ROLES = ["palette", "form", "motion", "texture", "mood"] as const; // also the fill priority
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
export const RATING_GRACE_MS = 3000; // rules allow votes until ratingEndsAt + grace (hard-coded in database.rules.json)
export const HOST_TICK_MS = 250; // host timer poll

export const NICK_MAX = 16;
export const NICK_MIN = 1;
export const OPTION_ID_MAX = 32;
export const OPTION_LABEL_MAX = 28;
export const PROMPT_TEXT_MAX = 120;
export const SESSION_CODE_LEN = 4;
export const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const SNAPSHOT_W = 1280;
export const SNAPSHOT_H = 720;
export const SNAPSHOT_JPEG_QUALITY = 0.8;

export const CANVAS_MAX_W = 1920;
export const CANVAS_MAX_H = 1080;
export const PIXEL_DENSITY_CAP = 1.5;
export const PARTICLE_CAP = 1200;
export const PARTICLE_FLOOR = 150;
export const FRAME_BUDGET_MS = 20; // above this, halve particles

export const EASE_NUMERIC_MS = 600; // time constant for numeric params
export const EASE_PALETTE_MS = 900; // color crossfade
export const FLICKER_MAX_HZ = 3; // photosensitivity; enforced in presets.ts
export const FLICKER_MAX_AREA = 0.25; // fraction of canvas any flicker may affect

export const ENERGY_WRITE_THROTTLE_MS = 150; // P2 energy dial only (D-08)

export const GEMINI_TIMEOUT_MS = 12000;
export const TTS_TIMEOUT_MS = 10000;
export const REIMAGINE_TIMEOUT_MS = 60000;
export const TIGER_TIMEOUT_MS = 5000;
export const TIGER_BUCKET_SECONDS = 10;
export const PULSE_POLL_MS = 10000;
export const VERDICT_WORDS_MIN = 40;
export const VERDICT_WORDS_MAX = 60;

export const SCORE_WEIGHTS = { author: 1, ai: 1, audience: 1 }; // equal to start

// ---- §2 Enums ----

export type Role = (typeof ROLES)[number];
export type RoundStatus = "lobby" | "live" | "locked" | "rating" | "reveal";
export type PlayerRole = "creator" | "spectator";
export type DurationMs = (typeof DURATIONS_MS)[number];
export type AuthorRankScore = (typeof AUTHOR_RANK_SCORES)[number];

// ---- §6 RenderParams (the renderer's single input; presets fill subsets) ----

export type RenderParams = {
  // palette
  colors: [string, string, string, string]; // bg wash, primary, secondary, accent (hex)
  washOpacity: number; // 0..1
  // form (atmosphere/particles)
  particleKind: "fog" | "steam" | "sparks" | "dust" | "none";
  particleDensity: number; // 0..1 → count = floor(density * adaptiveCap)
  particleSize: number; // px at 1080p
  particleSpeed: number; // px/s
  particleDrift: number; // noise influence 0..1
  // motion (hotspots + global)
  motionKind: "still" | "pulse" | "sway" | "flicker" | "drift";
  motionRateHz: number; // PROTECTED: clamped ≤ FLICKER_MAX_HZ
  motionAmplitude: number; // 0..1
  motionArea: number; // PROTECTED: fraction of canvas ≤ FLICKER_MAX_AREA
  // texture
  grainAmount: number; // 0..1
  grainScale: number; // px
  vignette: number; // 0..1
  // mood
  moodWord: string; // ≤ 14 chars, drawn as faint watermark
  energy: number; // 0..1
};
export const PROTECTED_PARAMS = ["motionRateHz", "motionArea"] as const; // overrides cannot set these

// ---- DATA_SCHEMA §2 /config/flags ----

export type Flags = {
  aiEnabled: boolean;
  voiceEnabled: boolean;
  reimagineEnabled: boolean;
  tigerEnabled: boolean;
  studioEnabled: boolean;
  maxJudgeCallsPerSession: number;
  maxTtsCharsPerSession: number;
  maxReimaginePerSession: number;
  geminiModel: string;
  geminiFallbackModel: string;
  imageModel: string;
  imageFallbackModel: string;
  ttsVoiceId: string;
  ttsModelId: string;
};

// ---- DATA_SCHEMA §3–4 /sessions/{code}/... ----
// RTDB does not store empty objects, so maps that start empty are optional on read.

export type SessionMeta = {
  hostUid: string;
  screenUid?: string;
  sceneId: string;
  createdAt: number;
  usedPromptIds?: Record<string, true>; // keyed `${sceneId}:${promptId}`
  usage?: { judgeCalls: number; ttsChars: number; reimagineCalls: number }; // functions only
  roundCounter: number;
};

export type Player = {
  nick: string;
  joinedAt: number;
  connected: boolean;
  lastSeen: number;
  role: PlayerRole;
  slot: Role | null;
  queuePos: number;
  isBot?: true;
  removed?: true;
};

export type Round = {
  id: string; // "r1", "r2", ...
  sceneId: string;
  promptId: string | null;
  promptText: string | null;
  seed: number; // 32-bit int
  durationMs: DurationMs;
  status: RoundStatus;
  startsAt: number | null; // endsAt = startsAt + durationMs, never stored
  lockedAt: number | null;
  ratingEndsAt: number | null;
  slots?: Partial<Record<Role, string>>; // role -> uid
  statusVersion: number;
};

export type Choice = { optionId: string; uid: string; at: number };
export type Choices = Partial<Record<Role, Choice>>;

export type ChoiceEvent = { t: number; role: Role; optionId: string; uid: string }; // t = ms since startsAt

export type Rating = number; // integer 1..5

export type AuthorResult = { score: number; perRole: Partial<Record<Role, number>> };
export type AiResult = { score: number; comment: string; model: string; fallback: boolean };
export type AudienceResult = { score: number | null; count: number; method: "trimmed" | "median" | "none" };
export type Verdict = { script: string; audioUrl: string | null; ready: boolean; fallback: boolean };
export type Reimagined = { status: "pending" | "ready" | "failed" | "skipped"; url?: string };

export type Results = {
  judgeRequestedAt?: number;
  snapshotUrl?: string;
  author?: AuthorResult; // host at lock
  ai?: AiResult; // judgeRound
  audience?: AudienceResult; // host at reveal
  combined?: number | null; // host at reveal
  verdict?: Verdict; // judgeRound
  reimagined?: Reimagined; // reimagineRound
};

export type ArchivedRound = {
  round: Round;
  choices?: Choices;
  events?: Record<string, ChoiceEvent>;
  ratings?: Record<string, Rating>;
  results?: Results;
  playersSnapshot: Record<string, { nick: string; slot: Role | null }>;
};

// ---- DATA_SCHEMA §5 Scene content ----

export type Shape = {
  d: string; // SVG path data
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  hotspot?: string; // demo scenes only
};

export type Option = {
  id: string; // unique within the scene, ≤ OPTION_ID_MAX
  presetId: string; // key in shared/presets.ts for this role
  label: string; // ≤ OPTION_LABEL_MAX
  authorScore: AuthorRankScore; // each value used once per role
  overrides?: Record<string, number | string>; // demo only; loader strips PROTECTED_PARAMS
};

export type Prompt = { id: string; text: string }; // text ≤ PROMPT_TEXT_MAX

export type Scene = {
  id: string;
  title: string;
  author: string;
  kind: "demo" | "custom";
  version: 1;
  baseArt: {
    viewBox: [number, number, number, number];
    background: string;
    shapes: Shape[];
  };
  options: Record<Role, Option[]>;
  prompts: Prompt[];
  createdAt?: number;
  authorUid?: string;
  moderation?: { approved: boolean; category: string; reason: string; at: number };
};

export type Preset = {
  id: string;
  role: Role;
  params: Partial<RenderParams>; // only the block this role owns
  label?: string;
};

// ---- DATA_SCHEMA §6 /gallery/{sceneId} (P0 host picker reads pinned entries) ----

export type GalleryEntry = {
  title: string;
  author: string;
  kind: "demo" | "custom";
  approved: boolean;
  pinned: boolean;
  plays: number;
  createdAt: number;
  authorUid?: string;
};

// ---- §7 Callable functions ----

export type JudgeRoundRequest = { sessionCode: string; roundId: string; snapshotJpegBase64: string };
export type JudgeRoundResponse = {
  ok: true;
  ai: { score: number; comment: string; fallback: boolean };
  verdict: { script: string; audioUrl: string | null; ready: boolean; fallback: boolean };
  snapshotUrl: string;
};

export type ReimagineRoundRequest = { sessionCode: string; roundId: string };
export type ReimagineRoundResponse = { ok: true; status: Reimagined["status"]; url?: string };

export type LogRoundEventsRequest = { sessionCode: string; roundId: string };
export type LogRoundEventsResponse =
  | { ok: true; inserted: number }
  | { ok: false; reason: "disabled" | "timeout" | "error" };

export type SessionPulseRequest = { sessionCode: string };
export type SessionPulseResponse = {
  stale: boolean;
  buckets: { t: string; role: Role; n: number }[];
  topOptions: Partial<Record<Role, { optionId: string; n: number }>>;
  rounds: { played: number; avgCombined: number | null; lastLockedAt: string | null };
};
