# HANDOFF

## Done this session
- B6 rules + emulator tests ([BUILD_ORDER](BUILD_ORDER.md) §3 Track B, §8 solo scope). Lane B.
- `database.rules.test.mts` (new, repo root): 36 assertions against the RTDB emulator. Covers own-record/own-nick only, removed player locked, host-only round/meta/results, choices by slot owner + own uid + live window, events append-only, ratings once/spectator/1–5/in window + 3 s grace, `judgeRequestedAt` once by screen, function-only `results/ai`, bots via host.
- `database.rules.json` unchanged: every case already held.

## Next
- Integration: T4a snapshot at lock (`web/screen/main.ts`, needs a `judgeRound` stub), then P1-3/P1-4 scores on reveal.

## Verify status
- typecheck, lint, test, build pass. Rules test passes (36/36) via the emulator command below; it is not in `npm test`.

## Decisions / docs
- None new.

## Blockers / open items
- `package.json` `test` still runs only `scoring.test.ts`. It should chain `web/lib/nick.test.ts`, `web/host/machine.test.ts`, the other `*.test.ts`, and a `test:rules` script for the emulator run (not changed: off-limits this session).

## Gotchas
- Run rules tests: set `JAVA_HOME` to `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot` and put `%JAVA_HOME%\bin` on `PATH` (Java is not on the PATH by default), then `firebase emulators:exec --only database "npx tsx database.rules.test.mts"`.
- File is `.mts` because root `package.json` has no `"type": "module"` and tsx compiles `.ts` as CommonJS (no top-level await).
- The test uploads the rules to its own emulator namespace (`rules-test`) and seeds with the emulator `owner` token, so it does not touch the default namespace or prod.
- The file is outside the root `tsconfig` include, so `npm run typecheck` skips it; tsx still type-strips it at run time.
- `now` windows use the real clock: the test moves `startsAt`/`ratingEndsAt` rather than faking time.
