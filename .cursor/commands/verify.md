Run the full check and report pass/fail per step. Fix failures you caused; don't change unrelated code.

Run from the repo root (skip a step with a note only if its script doesn't exist yet; see [BUILD_ORDER](../../docs/BUILD_ORDER.md)):

1. Typecheck: `npm run typecheck`
2. Lint: `npm run lint`
3. Tests: `npm test` (includes scoring self-check and rules emulator tests when present)
4. Build: `npm run build`

Then confirm against [AGENTS.md](../../AGENTS.md) rules: no secrets in `web/` or `shared/`, no brand names, no live AI paths in a round. End with a one-line summary.
