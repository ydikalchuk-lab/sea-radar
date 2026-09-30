# Checkpoint 05 — Sprint 03 R3 verification complete

**Recorded:** 2026-09-30

**Branch:** `feat/sprint-03-r3-test-evidence`

**Starting point:** Sprint 02 R2 checkpoint in `docs/checkpoints/CHECKPOINT-04.md`; base commit `5564c1972aef229daeb0e84721796cf1901d381d`.

## Delivered

- Split Playwright Test into a Node project for `aisstream-*.spec.ts` and a Chromium project for browser specs. The existing key and reader specs remain in the Node project; B-07 browser tests remain in Chromium.
- Expanded PositionReport converter assertions using the saved synthetic sample and explicitly named synthetic variations. Literal cases cover the full sample-to-Vessel mapping; missing/blank/padded names; absent, blank and empty MMSI; unparseable time; invalid numeric/string positions including `(95, -200)`; speed `0`, `102.3`, `-1`, and missing; course `360`; malformed envelopes; and valid latitude/longitude, speed, and course boundaries.
- Added collector tests using only the R2-injected event source, timer and clock. They cover duplicate reports, newer/older/equal/millisecond timestamps, whole-object replacement with a null name, the 100-unique-vessel limit and rejected 101st vessel, repeated IDs, empty-window success, exact injected completion time, pre-open timeout/error, provider error and disconnect after partial input, cancellation, single settlement, late callbacks, and cleanup through the fake source/timer boundary. No WebSocket is opened and no global clock is replaced.
- Added browser-clock tests for selected demo vessel movement and route completion/stop; the test clock is installed before navigation and advanced with `page.clock.runFor` without real waits.
- Added stubbed UI cases for unavailable name/speed/course (neutral marker and “Немає даних”) and malformed successful response fail-closed behavior. Existing empty/error/latest-attempt checks remain intact.
- No production-code changes were needed. The tests confirmed no divergence from the specified R1/R2 behavior.

## Verification performed

- `npx playwright test --project=node tests/aisstream-position-report.spec.ts` — passed, **12 tests**.
- `npx playwright test --project=node tests/aisstream-collector.spec.ts` — passed, **15 tests**.
- `npx playwright test --project=node` — passed, **34 tests** before the final three converter-edge assertions; the final full-suite run below includes them.
- `npx playwright test --project=chromium tests/demo-motion.spec.ts` — passed, **2 tests**.
- `npx playwright test --project=chromium tests/snapshot-ui.spec.ts` — passed, **9 tests**.
- `npx playwright test --project=chromium` — passed, **19 tests**.
- Final `npx playwright test` — passed, **56 tests** (37 Node-project and 19 Chromium-project tests); includes existing B-07 and R2 regression checks.
- Final `npm run build` — passed on Next.js 16.3.7; TypeScript completed and routes `/`, `/_not-found`, and `/api/snapshot` were generated.
- `git diff --check` — passed with no whitespace errors.

Playwright emitted the environment warning that `NO_COLOR` is ignored when `FORCE_COLOR` is set. It did not affect test results.

## B-17 review and divergence record

- **Confirmed divergences from agreed R1/R2 behavior:** none. The converter, collector, demo motion, and UI requirements passed their literal assertions. Zero findings is an accepted Sprint 03 result; no production fix or refactor was made.
- **Independent review:** a fresh read-only reviewer reviewed the Sprint 03 spec, plan, R3 diff, relevant tests and R2 implementation; recommendation: accept; concrete findings: none. The reviewer’s first static pass noted missing direct coverage of the exact `(95, -200)` pair and positive `(90, 180)` boundaries. Those literal cases were added, rerun (12 converter tests passed), and then confirmed in a follow-up review. The independent reviewer did not rerun the suite; verification outputs above are from the authoring session.
- **Review limitations:** this review and test suite do not establish live AISStream connectivity or the truth/completeness of provider data. No live connection or key was used. Reviewer review was static; runtime evidence is separately provided by the recorded test and build runs.
- **UI rule:** “result of the latest attempt” remains unchanged; the prior latest-attempt replacement test still passes. Empty success remains distinct from an error and is not described as proof that the area has no vessels.
- **Test-clock note:** the first full parallel Chromium run exposed a browser-test timing race when pausing exactly at a just-read `Date.now()` value (`Cannot fast-forward to the past`). The test now pauses one minute ahead of the current mock time and advances relative intervals with `runFor`; focused and full Chromium suites pass. This was test setup only, not a production divergence.

## Scope and limitations

- No real AISStream request was made and no real key was read or used. The automated UI tests stub `GET /api/snapshot`; they do not verify provider availability or claim live data.
- Collector resource assertions observe the injected fake source and fake timer; they do not open or inspect a real provider socket.
- Tests are deterministic contract checks, not a coverage target. No new feature, collection-rule change, or incidental production refactor was introduced.
- This remains a teaching demonstration, not a navigation or monitoring system.
