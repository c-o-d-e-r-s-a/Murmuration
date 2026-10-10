Review the current uncommitted diff (`git diff` plus untracked files).

Check, in order:
1. Violations of the non-negotiables in [AGENTS.md](../../AGENTS.md) and [DECISIONS](../../docs/DECISIONS.md) (smoothing, no live AI, server-side keys, tiny payloads, no brands, scope P0–P3, single writer, determinism).
2. Lane: files changed outside the author's lane.
3. Contract drift from [CONTRACTS](../../docs/CONTRACTS.md) / [DATA_SCHEMA](../../docs/DATA_SCHEMA.md) / [ROUND_STATE_MACHINE](../../docs/ROUND_STATE_MACHINE.md) transitions.
4. Missing check for non-trivial logic; unused code introduced by the diff.

Output a short list: **Must fix** / **Should fix** / **OK**, each with `file:line`. Don't edit unless asked.
