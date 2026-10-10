# HANDOFF

## Done this session
- Manual verify on deployed build: **P1-5** (rotation) and **P1-9** (Tiger mirror) — [BUILD_ORDER](BUILD_ORDER.md) §8.
- Deployed `hosting,functions` to `murmuration-33d60`; session `NHET`, 60 s rounds, 6 bots / 3 slots.
- No source changes; no commit.

## In progress / next
- **P1-10** pulse panel (`sessionPulse`) — next solo §8 task after Tiger mirror.
- Optional: real-phone LAN run still open.

## Verify status
| Step | Result |
|---|---|
| Deploy + `tigerEnabled=true` | **pass** |
| P1-5: 2 rounds, all 6 bots Creator | **pass** (r1: bot_1/2/3; r2: bot_4/5/6) |
| P1-9: RTDB vs Tiger event count (r1) | **pass** (7 = 7) |
| Tiger off: lock→reveal timing | **pass** (r2 on 26.5 s; r3 off 26.5 s; both hit AI rating cap) |
| Restore `tigerEnabled=true` | **pass** |

## Decisions / docs
- No new D-nn; docs unchanged.

## Blockers / open items
- Carried: real-phone LAN, P1-2 audio, `meta.screenUid`, custom-domain auth check.
- Prior SASL concern on `TIGER_DATABASE_URL` not reproduced this run (insert + SELECT ok).

## Gotchas
- Host tab must stay active for T3–T5 (background throttle stalls the machine); put `/screen` in front briefly at lock if needed for snapshot.
- Lock→reveal variance is mostly AI verdict readiness (12–25 s rating window), not Tiger; compare like-for-like (both at cap, or both early-ready).
- Tiger uniqueness `(session_code, round_id, t_ms, role, time)` can collapse same-ms same-role events; rare bot undercount.
- Test session `NHET` left in RTDB at r3 reveal; prior junk session `M2DS` may still exist.
