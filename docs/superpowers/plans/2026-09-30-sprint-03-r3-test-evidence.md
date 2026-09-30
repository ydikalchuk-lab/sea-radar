# Sprint 03 R3 Test Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Sprint 03 B-14–B-17 with repeatable evidence for PositionReport conversion, snapshot collection, demo motion, and existing R2 UI states, changing production behavior only when a test proves a confirmed R1/R2 divergence.

**Architecture:** Keep the existing Playwright Test runner and separate its AISStream Node-only specs from Chromium browser specs. Extend the converter tests and add collector tests that use the injected event source and clock already exposed by R2; use `page.clock` only for demo-motion/UI tests. Review any confirmed failures before making the smallest production fix, then record the factual results and independent review in Checkpoint 05.

**Tech Stack:** Node.js 24; TypeScript 6.x (`strict`); Next.js App Router; React 19; Leaflet 1.9.x; `@playwright/test` 1.63.x.

**Spec:** `docs/tasks/SPRINT-03.md`; R2 contracts and implementation baseline: `docs/checkpoints/CHECKPOINT-04.md`.

## Global Constraints

- **Runner:** Playwright Test. Checks for the converter and collector use a Node project of the same runner without a browser; checks for movement and interface use the browser project.
- **Independent expectations:** expected values are specified as literals before writing assertions and are not computed by the function under test.
- **Collector tests:** use the R2-injected event source and clock; do not open a WebSocket.
- **Time:** browser tests use `page.clock`; collector tests use the clock passed to the collector. One does not replace the other. Do not use real `waitForTimeout` waits.
- **Converter inputs:** use the saved sample and explicitly synthetic variants based on it; include “synthetic” in each synthetic fixture/test name.
- **Live connection:** do not test it automatically; its status was recorded manually last week.
- **Production code is not changed until the checks show a confirmed divergence.** If a divergence is confirmed, make only its minimal fix and rerun its test.
- Do not add features, incidental refactors, changed collection rules, or tests solely to increase a coverage metric.
- Keep the R2 “result of the latest attempt” UI rule unchanged. Keep all existing B-07 checks passing.
- Do not read or use a real AISStream key, call AISStream, or claim live data was verified.

## Review Focus

These additional edge cases supplement the cases explicitly listed in the spec; each is pinned by a test in its owning task.

1. **Converter receives a malformed envelope** (`null`, an array, or a missing/non-record nested `PositionReport`) → return `null` without throwing or fabricating a vessel. Test in Task 3.
2. **Converter receives values exactly at valid numeric boundaries** (latitude `-90`/`90`, longitude `-180`/`180`, speed `102.2`, course `359.9`) → preserve the valid values. Test in Task 3.
3. **Collector receives timestamps one millisecond apart** → the later report wins at millisecond precision. Test in Task 4.
4. **Collector source invokes callbacks after a terminal result** → the settled result stays unchanged, the source is closed once, and no timer remains. Test in Task 5.
5. **UI receives HTTP 200 with an inconsistent success payload** (for example, `count: 2` with one vessel) → fail closed with no markers/card and the fixed internal-error message. Test in Task 7.

---

## File Structure

- Modify `playwright.config.ts` to classify `aisstream-*.spec.ts` as Node-project tests and keep the remaining specs in the existing Chromium project. Retain the current loopback `webServer` configuration.
- Modify `tests/aisstream-position-report.spec.ts` for B-14, preserving the saved-sample mapping check and adding clearly named synthetic variations.
- Create `tests/aisstream-collector.spec.ts` for B-15, with a fake `AisStreamHandlers` source and deterministic injected timer/clock. It must never import a live socket implementation as a test dependency.
- Create `tests/demo-motion.spec.ts` for browser-clock movement and route-stop checks in B-16.
- Modify `tests/snapshot-ui.spec.ts` only for missing B-16 assertions; retain and rely on its existing error and empty-response checks.
- Create `docs/checkpoints/CHECKPOINT-05.md` for B-17, following the factual structure of `docs/checkpoints/CHECKPOINT-04.md`. `docs/checkpoints/TEMPLATE.md` is not present in the current checkpoint directory.
- Production files are conditional changes only: `src/lib/aisstream/position-report.ts`, `src/lib/aisstream/collector.ts`, `src/lib/demo-motion.ts`, `src/app/components/DemoMapClient.tsx`, `src/app/components/LeafletMap.tsx`, or `src/app/components/VesselCard.tsx` may be changed only when an automated test demonstrates a confirmed divergence from R1/R2 behavior. Before any Next.js application-code edit, read the relevant installed guide under `node_modules/next/dist/docs/` as required by the project instructions.

## Execution Order

The literal expected values below are taken from the Sprint 03 specification and the existing saved sample. Do not change them to match a failing implementation. If a test exposes a difference, carry it to Task 8 for review before changing production code.

---

### Task 1: Approve the evidence matrix before code

**Files:**
- Read only: `docs/tasks/SPRINT-03.md`, `docs/checkpoints/CHECKPOINT-04.md`, and the test paths listed in this plan.
- Modify: none.

**Interfaces:**
- Produces the human-approved list of literal expectations for B-14, B-15, and B-16. All following tasks implement assertions against this list; no expected value may be harvested from a run of the code under test.

- [ ] **Step 1: Present the B-14 expectations without code.** Confirm the saved sample maps to `{ id: '000000000', name: 'Synthetic Sample Vessel', lat: 51.05, lon: 1.42, speedKnots: 12.3, courseDeg: 135.2, timestamp: '2024-01-01T12:00:00.123Z', source: 'aisstream' }`; absent/blank name becomes `null`; speed `0` stays `0`; speed `102.3`, `-1`, or missing becomes `null`; course `360` becomes `null`; invalid coordinates, empty MMSI, and unparseable time reject the position.
- [ ] **Step 2: Present the B-15 expectations without code.** Confirm one object per MMSI; later timestamp wins and exact ties keep the first object; a later report replaces the whole vessel, including a `null` name; the 100th unique valid vessel ends successfully with `reason: 'limit_reached'` and `truncated: true`; duplicate IDs do not end collection early; empty window expiry succeeds; connect/provider/disconnect failures and cancellation do not return partial vessels; all terminal paths clean resources; `collectedAt` is the injected clock value at completion.
- [ ] **Step 3: Present the B-16 expectations without code.** Confirm a selected demo card follows a changed position under `page.clock`; at route end it remains at the last point with `0 kn`, final course, and final-step time; stubbed API error, empty success, and success with unavailable speed/course produce the exact R2 UI states in the spec.
- [ ] **Step 4: Stop if any expected value is challenged.** Resolve that expectation with the human from the written spec before adding assertions. Do not infer the expected value by calling the implementation.

**Acceptance:** the human has approved the expectation matrix; no files or production code changed in this task.

---

### Task 2: Separate Node and browser Playwright projects

**Files:**
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces a `node` Playwright project matching `**/aisstream-*.spec.ts` and a `chromium` project excluding that pattern. AISStream Node specs do not request `page`, `context`, or another browser fixture. The current `webServer` setting remains shared and unchanged.

- [ ] **Step 1: Add the Node project and exclude its files from Chromium.** Keep `testDir`, `fullyParallel`, reporter, base URL, device settings, and web server as they are. Use this project shape:

```ts
projects: [
  {
    name: 'node',
    testMatch: '**/aisstream-*.spec.ts',
  },
  {
    name: 'chromium',
    testIgnore: '**/aisstream-*.spec.ts',
    use: { ...devices['Desktop Chrome'] },
  },
],
```

- [ ] **Step 2: Run one existing Node-only spec in the Node project.** Run `npx playwright test --project=node tests/aisstream-position-report.spec.ts`. Expected: the spec runs without opening a browser; current assertions pass.
- [ ] **Step 3: Run one existing browser spec in Chromium.** Run `npx playwright test --project=chromium tests/snapshot-ui.spec.ts`. Expected: Chromium remains selected and the existing R2 UI tests pass.
- [ ] **Step 4: Review the configuration diff.** Confirm the browser and Node patterns do not overlap, and no dependency, script, test runner, or unrelated setting was added.
- [ ] **Step 5: Commit the isolated configuration change.** Use `test: split Playwright node and browser projects` and include the required `Co-Authored-By: Claude Code <noreply@anthropic.com>` trailer if this plan is executed by Claude Code.

---

### Task 3: B-14 — Pin PositionReport conversion with literal expectations

**Files:**
- Modify: `tests/aisstream-position-report.spec.ts`
- Read only unless Task 8 confirms a defect: `src/lib/aisstream/position-report.ts`, `data/samples/position-report.sample.json`

**Interfaces:**
- Consumes: the existing `convertPositionReport(raw: unknown): Vessel | null`, saved sample, `copySample()`, and `nestedSample()` test helpers.
- Produces: Node-only tests whose expected `Vessel` values and invalid-result expectations are literals independent of `convertPositionReport`.

- [ ] **Step 1: Preserve the complete saved-sample mapping assertion.** Keep the full literal object from Task 1; do not derive `expected` by passing the fixture to `convertPositionReport`.
- [ ] **Step 2: Add synthetic name and identity/time cases.** Name each test with `synthetic`; cover deleted `ShipName` and whitespace-only `ShipName` as `null`, missing and empty/whitespace MMSI as `null` result, and `time_utc: 'not a timestamp'` as `null` result. Example:

```ts
test('synthetic missing and blank names become null', () => {
  const input = nestedSample();
  delete input.MetaData.ShipName;
  expect(convertPositionReport(input)?.name).toBeNull();

  input.MetaData.ShipName = '   ';
  expect(convertPositionReport(input)?.name).toBeNull();
});
```

- [ ] **Step 3: Add synthetic motion-field cases.** Assert `Sog: 0` yields `speedKnots: 0`; `Sog: 102.3`, `Sog: -1`, and a deleted `Sog` each yield `speedKnots: null`; `Cog: 360` yields `courseDeg: null`. Keep invalid optional fields from rejecting a valid position.
- [ ] **Step 4: Add synthetic invalid-position cases.** Separately cover latitude `91`, longitude `181`, latitude/longitude pair `95`/`-200`, and string coordinates `'51.05'`/`'1.42'`; each must return `null`, not a vessel whose position is fabricated as `0,0`.
- [ ] **Step 5: Add the two Review Focus cases.** Assert malformed envelopes (`null`, `[]`, and a `PositionReport` array) return `null` without throwing. Assert exact valid limits `lat: -90`, `lon: -180`, `Sog: 102.2`, `Cog: 359.9` survive unchanged. These are synthetic inputs.
- [ ] **Step 6: Run the focused Node spec.** Run `npx playwright test --project=node tests/aisstream-position-report.spec.ts`. Expected after Task 8: all converter checks pass. Record any present failure without patching production here.
- [ ] **Step 7: Review and commit the test-only diff.** Confirm every new synthetic test name includes `synthetic`, all expectations are literal, and no production code changed. Commit as `test: pin AIS position conversion expectations` with the required Claude co-author trailer if applicable.

---

### Task 4: B-15 — Verify collection, deduplication, and limits

**Files:**
- Create: `tests/aisstream-collector.spec.ts`
- Read only unless Task 8 confirms a defect: `src/lib/aisstream/collector.ts`, `src/lib/aisstream/reader.ts`, `data/samples/position-report.sample.json`

**Interfaces:**
- Consumes: `collectSnapshot({ apiKey, signal, now, setTimer, clearTimer, openSource, windowMs, maxVessels })`, existing `AisStreamHandlers`/`AisStreamHandle`, and the saved sample.
- Produces: synthetic raw reports, a fake injected source, and assertions over literal result objects; no WebSocket or global `Date` replacement.

- [ ] **Step 1: Add a synthetic report builder based on the saved sample.** It changes only the fixture fields needed per case; include `synthetic` in each test title. Use the exact handler shape exported by `reader.ts`:

```ts
type SyntheticReport = {
  id: string;
  timeUtc: string;
  lat: number;
  lon: number;
  name: string | null;
  sog: number;
  cog: number;
};

function syntheticReport(overrides: SyntheticReport): unknown {
  const raw = structuredClone(sample) as {
    MetaData: Record<string, unknown>;
    Message: { PositionReport: Record<string, unknown> };
  };
  raw.MetaData.MMSI = overrides.id;
  raw.MetaData.ShipName = overrides.name;
  raw.MetaData.time_utc = overrides.timeUtc;
  raw.Message.PositionReport.Latitude = overrides.lat;
  raw.Message.PositionReport.Longitude = overrides.lon;
  raw.Message.PositionReport.Sog = overrides.sog;
  raw.Message.PositionReport.Cog = overrides.cog;
  return raw;
}
```

- [ ] **Step 2: Add a deterministic collector harness.** Capture `AisStreamHandlers` in `openSource`; return `{ close: () => { closeCalls += 1; } }`; implement `now` from a test-owned `Date` value; make `setTimer` save its callback under a fake handle and `clearTimer` remove it. Expose only `emit(raw)`, `ready()`, `fail(code)`, `disconnect()`, `expireWindow()`, `setNow(iso)`, `abort()`, `closeCalls()`, and `pendingTimerCount()`. Never call `openAisStream` or override global `Date`/timers.
- [ ] **Step 3: Test exact duplicates and out-of-order messages.** Emit the same synthetic report for vessel `A` twice and assert one literal object remains. In a separate test emit the 12:01 report at P2 `{ lat: 51.06, lon: 1.43 }`, then the 12:00 report at P1 `{ lat: 51.05, lon: 1.42 }`; assert the sole returned object is the full literal P2 vessel with timestamp `2026-01-01T12:01:00.000Z`.
- [ ] **Step 4: Test equal and millisecond-separated timestamps.** Equal timestamps at different positions retain the first literal object. A report at `2026-01-01T12:00:00.001Z` replaces one at `2026-01-01T12:00:00.000Z`; this is the millisecond Review Focus assertion.
- [ ] **Step 5: Test whole-object replacement.** Emit the same ID first with name `'Synthetic A'`, then with `name: null` and a later timestamp; assert the final literal vessel has `name: null` and the later coordinates/time, not a merge with the previous object.
- [ ] **Step 6: Test the 100-unique-vessel limit.** Emit 101 synthetic reports with distinct IDs. Assert literal `count: 100`, `truncated: true`, `reason: 'limit_reached'`, that IDs `'synthetic-000'` and `'synthetic-099'` are present, and `'synthetic-100'` is absent. Assert the source closed once and the timer was cleared.
- [ ] **Step 7: Test duplicate IDs do not hit the limit.** Emit 100 reports for the same synthetic ID, then fire the controlled window timer. Assert literal `count: 1`, `truncated: false`, `reason: 'window_elapsed'`; this distinguishes the unique-vessel cap from a raw-message cap.
- [ ] **Step 8: Test the completion timestamp.** Set the injected clock to `2026-01-01T12:15:00.000Z` immediately before window completion and assert literal `collectedAt: '2026-01-01T12:15:00.000Z'` and `windowSeconds: 15`.
- [ ] **Step 9: Run the focused collector spec.** Run `npx playwright test --project=node tests/aisstream-collector.spec.ts`. Expected after Task 8: all aggregation/limit checks pass; record red results without changing the collector in this task.
- [ ] **Step 10: Review and commit the test-only diff.** Confirm no real socket, real sleep, computed expected vessel, or production-code edit was introduced. Commit as `test: cover snapshot collection ordering and limits` with the required Claude co-author trailer if applicable.

---

### Task 5: B-15 — Verify terminal outcomes and cleanup

**Files:**
- Modify: `tests/aisstream-collector.spec.ts`
- Read only unless Task 8 confirms a defect: `src/lib/aisstream/collector.ts`, `src/lib/aisstream/errors.ts`, `src/lib/aisstream/reader.ts`

**Interfaces:**
- Consumes the fake harness from Task 4 and its captured `AisStreamHandlers`.
- Collector cancellation follows the existing R2 contract: it must not resolve accumulated vessels as success; the current implementation rejects with `SnapshotError('internal')`, closes the source, and clears the timer.

- [ ] **Step 1: Test empty normal completion.** Call `ready()`, emit no reports, set the fake clock to `2026-01-01T12:00:15.000Z`, and expire the window. Assert a literal empty success: `vessels: []`, `count: 0`, `truncated: false`, `reason: 'window_elapsed'`, `collectedAt: '2026-01-01T12:00:15.000Z'`.
- [ ] **Step 2: Test connect timeout and pre-open connection error.** Without calling `ready()`, expire the timer and assert `connect_failed`; in a separate case call `fail('connect_failed')` before `ready()` and assert immediate rejection. Neither case may resolve a success.
- [ ] **Step 3: Test provider error and disconnect after partial input.** Emit three distinct valid synthetic vessels, then call `fail('provider_error')` or `disconnect()` in separate tests. Assert rejection with the corresponding code and that no accumulated vessel array is returned as success.
- [ ] **Step 4: Test cancellation before window completion.** Emit a valid report, call `abort()`, and assert rejection with `{ code: 'internal' }`, one source close, and zero pending timers. Do not assert a successful partial result.
- [ ] **Step 5: Test error after limit completion and late callbacks.** Reach 100 unique vessels and await the literal limit success; then call `fail('provider_error')`, `disconnect()`, and `emit()` on the captured handler. Assert the original result stays unchanged, `closeCalls() === 1`, and `pendingTimerCount() === 0`.
- [ ] **Step 6: Assert cleanup for every terminal branch.** Reuse one assertion helper that checks source close count is one and pending timer count is zero after empty timeout, connect timeout, pre-open error, provider error, disconnect, abort, and limit success. Invoke a captured cleared timer callback after settlement where available; assert it cannot produce a second outcome.
- [ ] **Step 7: Run focused and combined Node tests.** Run `npx playwright test --project=node tests/aisstream-collector.spec.ts`, then `npx playwright test --project=node`. Expected after Task 8: both pass, including existing key/reader/converter specs; no browser is launched for these test files.
- [ ] **Step 8: Review and commit the test-only diff.** Confirm rejection paths discard partial values and cleanup assertions use the fake source, not socket inspection. Commit as `test: verify collector failures and cleanup` with the required Claude co-author trailer if applicable.

---

### Task 6: B-16 — Verify demo movement and route stop with browser time

**Files:**
- Create: `tests/demo-motion.spec.ts`
- Read only unless Task 8 confirms a defect: `src/lib/demo-motion.ts`, `src/app/components/DemoMapClient.tsx`, `src/data/demo-vessels.ts`, `src/config/app.ts`, `src/app/components/VesselCard.tsx`

**Interfaces:**
- Consumes: the existing browser project, demo route `demo-1`, `DEMO_TICK_MS = 2000`, marker `data-vessel-id`, selected vessel card, and Playwright `page.clock`.
- Produces: browser assertions that advance page time deterministically. Do not use the injected collector clock or real sleeps in this task.

- [ ] **Step 1: Add the controlled-time movement test.** Before navigation install `page.clock` at `2026-09-30T12:00:00.000Z`; block OSM tiles before `page.goto('/')`; select `demo-1`; once the map/card are ready, pause the clock at `await page.evaluate(() => Date.now())` so page-load time cannot consume the test ticks. Capture marker transform and card coordinates; run `await page.clock.runFor(6_000)`. Assert the card coordinates differ from the captured value, remain a formatted coordinate pair, the selected card stays visible, and the marker transform changes. Do not assume the interval had not ticked during navigation.
- [ ] **Step 2: Add the route-end/stop test.** In a fresh page install the same clock before navigation, block OSM tiles, select `demo-1`, and pause at the current `Date.now()` after the card is ready. Capture the initial coordinate/time and assert the route is not already at its final point. Advance with `await page.clock.runFor(30_000)`. Assert literal final coordinates `51.10000, 1.65000`, speed `0 kn`, and final segment course `68°`; assert the displayed time has `HH:MM:SS UTC` format and differs from the pre-movement time. Capture that final-step time and the marker transform, advance another three ticks with `runFor(6_000)`, and assert the position, transform, speed, course, and exact captured timestamp remain unchanged.
- [ ] **Step 3: Use `runFor`, not `fastForward`, for repeated interval ticks.** `runFor` executes each due interval callback; `fastForward` skips overdue timers and fires each at most once, so it cannot prove multiple movement ticks.
- [ ] **Step 4: Run the browser motion spec.** Run `npx playwright test --project=chromium tests/demo-motion.spec.ts`. Expected after Task 8: both controlled-time tests pass without `waitForTimeout`.
- [ ] **Step 5: Review and commit the test-only diff.** Confirm time is installed before navigation, the OSM route is aborted before navigation, and no production changes were made. Commit as `test: verify demo motion with controlled browser time` with the required Claude co-author trailer if applicable.

---

### Task 7: B-16 — Verify R2 snapshot UI states

**Files:**
- Modify: `tests/snapshot-ui.spec.ts`
- Read only unless Task 8 confirms a defect: `src/app/components/DemoMapClient.tsx`, `src/app/components/LeafletMap.tsx`, `src/app/components/VesselCard.tsx`, `src/lib/vessel-display.ts`

**Interfaces:**
- Consumes: existing `snapshot()` helper, browser project, and the `GET /api/snapshot` route stubbed through `page.route`.
- Produces: assertions against the current fixed Ukrainian labels, the shared vessel card, and marker attribute `data-icon`; no browser test calls AISStream.

- [ ] **Step 1: Preserve the existing R2 error and empty tests.** Keep the current fixed-error, empty-success, latest-attempt, and unknown-error-copy assertions. They already cover the required empty and error state families; do not duplicate them.
- [ ] **Step 2: Add a successful response with unavailable fields.** Stub `GET /api/snapshot` with one otherwise valid AIS vessel whose `name`, `speedKnots`, and `courseDeg` are `null`; select its marker. Assert `data-icon="neutral"`, the vessel card is visible, and the name, speed, and course fields each render `Немає даних`. This also verifies the B-14 name normalization is rendered safely by the existing card.
- [ ] **Step 3: Add the malformed-success Review Focus case.** Stub HTTP 200 with `ok: true`, one valid synthetic vessel, but `count: 2`. Assert no `[data-vessel-id]` marker and no vessel card appear; assert `Даних на карті немає` and `Не вдалося отримати дані: Внутрішня помилка сервера`.
- [ ] **Step 4: Run the focused browser UI spec.** Run `npx playwright test --project=chromium tests/snapshot-ui.spec.ts`. Expected after Task 8: all existing and added R2 state checks pass; route responses remain stubbed.
- [ ] **Step 5: Review and commit the test-only diff.** Confirm the null-motion case proves both neutral marker and missing-data card copy, and the malformed payload fails closed. Commit as `test: cover neutral AIS fields and invalid snapshots` with the required Claude co-author trailer if applicable.

---

### Task 8: B-17 — Review findings, minimal fixes, and Checkpoint 05

**Files:**
- Create: `docs/checkpoints/CHECKPOINT-05.md`
- Modify production files only for confirmed test failures that contradict Sprint 03 or the R1/R2 contract.
- Read only for independent review: `docs/tasks/SPRINT-03.md`, `docs/checkpoints/CHECKPOINT-04.md`, the final diff, and actual test/build results.

**Interfaces:**
- Produces: a possibly empty list of confirmed divergences, an independent-review findings list, exact verification outcomes/limitations, and a Checkpoint 05 record. The reviewer cannot edit files or change expected values.

- [ ] **Step 1: Triage every failing assertion against the approved expectation matrix.** For each red test, classify it as (a) a test that does not match the written literal expectation, or (b) a confirmed product divergence. Correct category (a) only with human agreement; do not loosen an assertion just to make it green.
- [ ] **Step 2: Make only confirmed minimal product fixes.** Change only the smallest production surface that explains the failing assertion. Do not refactor or alter collection rules. Before touching a Next.js route/component, read its relevant installed guide from `node_modules/next/dist/docs/`.
- [ ] **Step 3: Rerun each affected test immediately.** Run the specific Node or Chromium test from its owning task, then rerun the entire owning project. Preserve the before/after result and changed-file list for Checkpoint 05.
- [ ] **Step 4: Run the complete verification set.** Run `npx playwright test`, `npm run build`, and `git diff --check`. Record the actual exit status and test count/output; do not substitute an expected result for observed output. Expected acceptance is all existing B-07 and new B-14–B-16 tests passing, a successful build, and a clean diff check.
- [ ] **Step 5: Start a fresh, read-only independent review.** Use the Sprint 03 instruction (`claude --permission-mode plan` or a separate permission set denying Edit/Write/Bash). Give that session `docs/tasks/SPRINT-03.md`, the diff from Checkpoint 04, and actual test results. Request only substantiated findings, review limitations, and “accept / revise”; the reviewer must not change code or expectations.
- [ ] **Step 6: Resolve review findings with the human.** Address only verified findings in scope, rerun the affected test and full verification set, or record why a finding is not a confirmed Sprint 03 divergence. The authoring session must not review its own changes in place of this fresh session.
- [ ] **Step 7: Write Checkpoint 05 from observed facts.** Follow `CHECKPOINT-04.md`’s factual sections. Include B-14–B-17 outcomes; actual commands and results; the divergence list (explicitly empty when none); independent findings and limitations; B-07 status; confirmation that latest-attempt UI behavior is unchanged; and that no live AISStream request was made or automatically tested. Distinguish automated checks from manual review.
- [ ] **Step 8: Confirm the archive destination before archiving.** Sprint 03 requires an archive but does not specify its path or mechanism, and no checkpoint template/archive is present in `docs/checkpoints`. Ask the human/mentor for the established archive destination; do not invent a repository path or place a copy elsewhere without that answer.
- [ ] **Step 9: Commit the accepted checkpoint as required by Sprint 03.** Only after the checkpoint content, review results, and archive destination are approved, stage the intended Sprint 03 files and create `docs: record Sprint 03 checkpoint` with the required `Co-Authored-By: Claude Code <noreply@anthropic.com>` trailer when Claude Code creates the commit. Do not commit unrelated files.
- [ ] **Step 10: Perform the final scope/diff check.** Confirm no key/secret, real-data claim, future-sprint placeholder, unrelated refactor, or unrequested feature entered the final diff. Report the archive outcome accurately.

---

## Acceptance Summary

- B-14: converter Node tests cover the sample and every specified synthetic field/position/time case with literal expectations.
- B-15: collector Node tests cover deduplication, ordering, limits, completion reasons/timestamps, errors, cancellation, one-time settlement, and resource cleanup through injected dependencies only.
- B-16: Chromium tests use `page.clock` for demo movement/stop and stub `GET /api/snapshot` for error, empty, and unavailable-motion UI states.
- B-17: only confirmed in-scope divergences are minimally corrected; an independent read-only review and its limitations are recorded; Checkpoint 05 is factual and archived at a human-confirmed destination.
- Existing B-07 tests continue to pass. Zero confirmed defects is a successful Sprint 03 result.
